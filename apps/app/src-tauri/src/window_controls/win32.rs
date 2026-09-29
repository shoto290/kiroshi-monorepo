use std::fmt::Display;
use std::sync::Mutex;

use tauri::{
	LogicalPosition, LogicalSize, Manager, PhysicalPosition, PhysicalSize, Runtime, WebviewWindow,
	WindowEvent,
};
use tokio::sync::oneshot;
use windows::core::{w, Error, PCWSTR};
use windows::Win32::Foundation::{
	ERROR_CLASS_ALREADY_EXISTS, HINSTANCE, HWND, LPARAM, LRESULT, WPARAM,
};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::WindowsAndMessaging::{
	CreateWindowExW, DefWindowProcW, GetParent, IsZoomed, PostMessageW, RegisterClassExW,
	SetWindowLongPtrW, SetWindowPos, GWLP_USERDATA, HTMAXBUTTON, HWND_TOP, SC_MAXIMIZE, SC_RESTORE,
	SWP_NOACTIVATE, SWP_SHOWWINDOW, WINDOW_EX_STYLE, WM_NCHITTEST, WM_NCLBUTTONDBLCLK,
	WM_NCLBUTTONDOWN, WM_NCLBUTTONUP, WM_SYSCOMMAND, WNDCLASSEXW, WS_CHILD, WS_CLIPSIBLINGS,
	WS_VISIBLE,
};

use super::{MaximizeButtonBounds, WindowFrameError};

const OVERLAY_CLASS: PCWSTR = w!("KiroshiMaximizeButton");
const PRESSED: isize = 1;
const RELEASED: isize = 0;

#[derive(Default)]
struct MaximizeButton(Mutex<Option<Overlay>>);

#[derive(Clone, Copy)]
struct Overlay {
	hwnd: isize,
	bounds: MaximizeButtonBounds,
}

struct Failure {
	error: WindowFrameError,
	cause: String,
}

impl Failure {
	fn unavailable(cause: impl Display) -> Self {
		Self { error: WindowFrameError::Unavailable, cause: cause.to_string() }
	}

	fn overlay(cause: impl Display) -> Self {
		Self { error: WindowFrameError::OverlayFailed, cause: cause.to_string() }
	}
}

pub fn frame<R: Runtime>(window: &WebviewWindow<R>) {
	if let Err(error) = window.set_decorations(false) {
		eprintln!("the main window kept its native frame: {error}");
	}
	window.manage(MaximizeButton::default());
	let subject = window.clone();
	window.on_window_event(move |event| {
		let WindowEvent::ScaleFactorChanged { scale_factor, .. } = event else {
			return;
		};
		if let Err(failure) = follow_scale(&subject, *scale_factor) {
			eprintln!(
				"the maximize button did not follow the scale factor {scale_factor} ({:?}): {}",
				failure.error, failure.cause
			);
		}
	});
}

pub async fn declare_maximize_button<R: Runtime>(
	window: WebviewWindow<R>,
	bounds: MaximizeButtonBounds,
) -> Result<(), WindowFrameError> {
	place_on_main_thread(window, bounds).await.map_err(|failure| {
		eprintln!(
			"the maximize button at {bounds:?} was not declared ({:?}): {}",
			failure.error, failure.cause
		);
		failure.error
	})
}

async fn place_on_main_thread<R: Runtime>(
	window: WebviewWindow<R>,
	bounds: MaximizeButtonBounds,
) -> Result<(), Failure> {
	if !is_drawable(bounds) {
		return Err(Failure {
			error: WindowFrameError::InvalidBounds,
			cause: "bounds out of range".into(),
		});
	}
	let (sender, receiver) = oneshot::channel();
	let target = window.clone();
	window
		.run_on_main_thread(move || {
			if sender.send(place(&target, bounds)).is_err() {
				eprintln!("the maximize button was placed after its caller left");
			}
		})
		.map_err(Failure::unavailable)?;
	receiver.await.map_err(Failure::unavailable)?
}

fn is_drawable(bounds: MaximizeButtonBounds) -> bool {
	[bounds.x, bounds.y, bounds.width, bounds.height]
		.iter()
		.all(|edge| edge.is_finite() && *edge >= 0.0)
		&& bounds.width > 0.0
		&& bounds.height > 0.0
}

fn place<R: Runtime>(
	window: &WebviewWindow<R>,
	bounds: MaximizeButtonBounds,
) -> Result<(), Failure> {
	let state = window
		.try_state::<MaximizeButton>()
		.ok_or_else(|| Failure::unavailable("the main window was never framed"))?;
	let mut declared = state.0.lock().map_err(Failure::unavailable)?;
	let hwnd = match *declared {
		Some(overlay) => overlay.hwnd,
		None => create_overlay(window)?,
	};
	*declared = Some(Overlay { hwnd, bounds });
	let scale = window.scale_factor().map_err(Failure::unavailable)?;
	position(hwnd, bounds, scale)
}

fn follow_scale<R: Runtime>(window: &WebviewWindow<R>, scale: f64) -> Result<(), Failure> {
	let Some(state) = window.try_state::<MaximizeButton>() else {
		return Ok(());
	};
	let declared = *state.0.lock().map_err(Failure::unavailable)?;
	match declared {
		Some(overlay) => position(overlay.hwnd, overlay.bounds, scale),
		None => Ok(()),
	}
}

fn physical(
	bounds: MaximizeButtonBounds,
	scale: f64,
) -> (PhysicalPosition<i32>, PhysicalSize<i32>) {
	(
		LogicalPosition::new(bounds.x, bounds.y).to_physical(scale),
		LogicalSize::new(bounds.width, bounds.height).to_physical(scale),
	)
}

fn position(hwnd: isize, bounds: MaximizeButtonBounds, scale: f64) -> Result<(), Failure> {
	let (origin, size) = physical(bounds, scale);
	unsafe {
		SetWindowPos(
			HWND(hwnd as _),
			Some(HWND_TOP),
			origin.x,
			origin.y,
			size.width,
			size.height,
			SWP_NOACTIVATE | SWP_SHOWWINDOW,
		)
	}
	.map_err(Failure::overlay)
}

fn create_overlay<R: Runtime>(window: &WebviewWindow<R>) -> Result<isize, Failure> {
	let parent = window.hwnd().map_err(Failure::unavailable)?;
	unsafe {
		let instance = HINSTANCE(GetModuleHandleW(None).map_err(Failure::overlay)?.0);
		register_overlay_class(instance)?;
		CreateWindowExW(
			WINDOW_EX_STYLE::default(),
			OVERLAY_CLASS,
			PCWSTR::null(),
			WS_CHILD | WS_VISIBLE | WS_CLIPSIBLINGS,
			0,
			0,
			0,
			0,
			Some(parent),
			None,
			Some(instance),
			None,
		)
	}
	.map(|hwnd| hwnd.0 as isize)
	.map_err(Failure::overlay)
}

unsafe fn register_overlay_class(instance: HINSTANCE) -> Result<(), Failure> {
	let class = WNDCLASSEXW {
		cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
		lpfnWndProc: Some(answer_as_the_maximize_button),
		hInstance: instance,
		lpszClassName: OVERLAY_CLASS,
		..Default::default()
	};
	if RegisterClassExW(&class) != 0 {
		return Ok(());
	}
	let error = Error::from_win32();
	if error.code() == ERROR_CLASS_ALREADY_EXISTS.to_hresult() {
		return Ok(());
	}
	Err(Failure::overlay(error))
}

unsafe extern "system" fn answer_as_the_maximize_button(
	hwnd: HWND,
	message: u32,
	wparam: WPARAM,
	lparam: LPARAM,
) -> LRESULT {
	match message {
		WM_NCHITTEST => LRESULT(HTMAXBUTTON as isize),
		WM_NCLBUTTONDOWN | WM_NCLBUTTONDBLCLK => {
			SetWindowLongPtrW(hwnd, GWLP_USERDATA, PRESSED);
			LRESULT(0)
		}
		WM_NCLBUTTONUP => {
			if SetWindowLongPtrW(hwnd, GWLP_USERDATA, RELEASED) == PRESSED {
				toggle_maximize(hwnd);
			}
			LRESULT(0)
		}
		_ => DefWindowProcW(hwnd, message, wparam, lparam),
	}
}

unsafe fn toggle_maximize(overlay: HWND) {
	let parent = match GetParent(overlay) {
		Ok(parent) => parent,
		Err(error) => {
			eprintln!("the maximize button found no window to toggle: {error}");
			return;
		}
	};
	let command = if IsZoomed(parent).as_bool() { SC_RESTORE } else { SC_MAXIMIZE };
	if let Err(error) =
		PostMessageW(Some(parent), WM_SYSCOMMAND, WPARAM(command as usize), LPARAM(0))
	{
		eprintln!("the maximize button did not toggle the window: {error}");
	}
}

#[cfg(test)]
mod tests {
	use super::{is_drawable, physical, MaximizeButtonBounds};

	const BUTTON: MaximizeButtonBounds =
		MaximizeButtonBounds { x: 1101.5, y: 0.0, width: 46.0, height: 34.0 };

	#[test]
	fn rounds_the_declared_bounds_to_physical_pixels_at_the_scale_factor() {
		let (origin, size) = physical(BUTTON, 1.25);
		assert_eq!((origin.x, origin.y, size.width, size.height), (1377, 0, 58, 43));
	}

	#[test]
	fn keeps_the_declared_bounds_at_the_unit_scale_factor() {
		let (origin, size) = physical(BUTTON, 1.0);
		assert_eq!((origin.x, origin.y, size.width, size.height), (1102, 0, 46, 34));
	}

	#[test]
	fn refuses_bounds_with_no_area_or_off_the_client_area() {
		for bounds in [
			MaximizeButtonBounds { width: 0.0, ..BUTTON },
			MaximizeButtonBounds { x: -1.0, ..BUTTON },
			MaximizeButtonBounds { height: f64::NAN, ..BUTTON },
		] {
			assert!(!is_drawable(bounds), "{bounds:?} was accepted");
		}
	}
}
