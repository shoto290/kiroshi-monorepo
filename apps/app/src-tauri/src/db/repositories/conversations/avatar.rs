use rusqlite::types::{FromSql, FromSqlError, FromSqlResult, ToSql, ToSqlOutput, ValueRef};

use super::super::messages::stored_as_text;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AvatarBlot {
	Red,
	Yellow,
	Green,
	Cyan,
	Blue,
	Purple,
	Pink,
	Orange,
}

impl AvatarBlot {
	fn as_sql(self) -> &'static str {
		self.named()
	}

	pub fn named(self) -> &'static str {
		match self {
			AvatarBlot::Red => "red",
			AvatarBlot::Yellow => "yellow",
			AvatarBlot::Green => "green",
			AvatarBlot::Cyan => "cyan",
			AvatarBlot::Blue => "blue",
			AvatarBlot::Purple => "purple",
			AvatarBlot::Pink => "pink",
			AvatarBlot::Orange => "orange",
		}
	}

	pub fn parse(text: &str) -> Option<Self> {
		match text {
			"red" => Some(AvatarBlot::Red),
			"yellow" => Some(AvatarBlot::Yellow),
			"green" => Some(AvatarBlot::Green),
			"cyan" => Some(AvatarBlot::Cyan),
			"blue" => Some(AvatarBlot::Blue),
			"purple" => Some(AvatarBlot::Purple),
			"pink" => Some(AvatarBlot::Pink),
			"orange" => Some(AvatarBlot::Orange),
			_ => None,
		}
	}
}

stored_as_text!(AvatarBlot);
