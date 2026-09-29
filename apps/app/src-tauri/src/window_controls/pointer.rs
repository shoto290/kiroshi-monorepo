use super::MaximizeButtonState;

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct Pointer {
	pub is_inside: bool,
	pub is_pressed: bool,
}

#[derive(Debug, Clone, Copy)]
pub enum PointerInput {
	Moved,
	Pressed,
	Released,
	Left,
}

#[derive(Debug, Default, PartialEq, Eq)]
pub struct Reaction {
	pub report: Option<MaximizeButtonState>,
	pub toggles_maximize: bool,
}

impl Pointer {
	pub fn react(self, input: PointerInput) -> (Self, Reaction) {
		match input {
			PointerInput::Moved if self.is_inside => (self, Reaction::default()),
			PointerInput::Moved => (
				Self { is_inside: true, ..self },
				Reaction { report: Some(MaximizeButtonState::Hover), toggles_maximize: false },
			),
			PointerInput::Pressed => (
				Self { is_inside: true, is_pressed: true },
				Reaction { report: Some(MaximizeButtonState::Pressed), toggles_maximize: false },
			),
			PointerInput::Released if self.is_pressed => (
				Self { is_inside: true, is_pressed: false },
				Reaction { report: Some(MaximizeButtonState::Hover), toggles_maximize: true },
			),
			PointerInput::Released => (self, Reaction::default()),
			PointerInput::Left if self == Self::default() => (self, Reaction::default()),
			PointerInput::Left => (
				Self::default(),
				Reaction { report: Some(MaximizeButtonState::Idle), toggles_maximize: false },
			),
		}
	}
}

#[cfg(test)]
mod tests {
	use super::{MaximizeButtonState, Pointer, PointerInput, Reaction};

	fn follow(inputs: &[PointerInput]) -> (Pointer, Vec<Reaction>) {
		inputs.iter().fold((Pointer::default(), Vec::new()), |(pointer, mut reactions), input| {
			let (next, reaction) = pointer.react(*input);
			reactions.push(reaction);
			(next, reactions)
		})
	}

	fn reported(state: MaximizeButtonState) -> Reaction {
		Reaction { report: Some(state), toggles_maximize: false }
	}

	#[test]
	fn reports_hover_once_per_entry() {
		let (_, reactions) = follow(&[PointerInput::Moved, PointerInput::Moved]);
		assert_eq!(reactions, [reported(MaximizeButtonState::Hover), Reaction::default()]);
	}

	#[test]
	fn a_press_then_a_release_toggles_maximize_and_returns_to_hover() {
		let (pointer, reactions) =
			follow(&[PointerInput::Moved, PointerInput::Pressed, PointerInput::Released]);
		assert_eq!(
			reactions,
			[
				reported(MaximizeButtonState::Hover),
				reported(MaximizeButtonState::Pressed),
				Reaction { report: Some(MaximizeButtonState::Hover), toggles_maximize: true },
			]
		);
		assert_eq!(pointer, Pointer { is_inside: true, is_pressed: false });
	}

	#[test]
	fn a_release_with_no_press_that_started_on_the_overlay_leaves_the_window_alone() {
		let (pointer, reactions) = follow(&[PointerInput::Moved, PointerInput::Released]);
		assert_eq!(reactions, [reported(MaximizeButtonState::Hover), Reaction::default()]);
		assert!(!pointer.is_pressed);
	}

	#[test]
	fn leaving_reports_idle_and_clears_the_press() {
		let (pointer, reactions) = follow(&[
			PointerInput::Moved,
			PointerInput::Pressed,
			PointerInput::Left,
			PointerInput::Moved,
			PointerInput::Released,
		]);
		assert_eq!(
			reactions,
			[
				reported(MaximizeButtonState::Hover),
				reported(MaximizeButtonState::Pressed),
				reported(MaximizeButtonState::Idle),
				reported(MaximizeButtonState::Hover),
				Reaction::default(),
			]
		);
		assert_eq!(pointer, Pointer { is_inside: true, is_pressed: false });
	}
}
