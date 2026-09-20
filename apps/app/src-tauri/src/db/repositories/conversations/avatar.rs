use rusqlite::types::{FromSql, FromSqlError, FromSqlResult, ToSql, ToSqlOutput, ValueRef};

use super::super::messages::stored_as_text;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AvatarAnimal {
	Cat,
	Rabbit,
	Bear,
	Chick,
	Dog,
	Mouse,
	Owl,
	Koala,
}

impl AvatarAnimal {
	fn as_sql(self) -> &'static str {
		match self {
			AvatarAnimal::Cat => "cat",
			AvatarAnimal::Rabbit => "rabbit",
			AvatarAnimal::Bear => "bear",
			AvatarAnimal::Chick => "chick",
			AvatarAnimal::Dog => "dog",
			AvatarAnimal::Mouse => "mouse",
			AvatarAnimal::Owl => "owl",
			AvatarAnimal::Koala => "koala",
		}
	}

	fn parse(text: &str) -> Option<Self> {
		match text {
			"cat" => Some(AvatarAnimal::Cat),
			"rabbit" => Some(AvatarAnimal::Rabbit),
			"bear" => Some(AvatarAnimal::Bear),
			"chick" => Some(AvatarAnimal::Chick),
			"dog" => Some(AvatarAnimal::Dog),
			"mouse" => Some(AvatarAnimal::Mouse),
			"owl" => Some(AvatarAnimal::Owl),
			"koala" => Some(AvatarAnimal::Koala),
			_ => None,
		}
	}
}

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

stored_as_text!(AvatarAnimal);
stored_as_text!(AvatarBlot);

pub(super) const DEFAULT_BOT_ANIMAL: AvatarAnimal = AvatarAnimal::Cat;
