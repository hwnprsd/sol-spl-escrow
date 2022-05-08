use anchor_lang::*;

#[error_code]
pub enum Errors {
    #[msg("Exactly two participants are allowed to participate with two amounts in the escrow. Not more not less")]
    ExactlyTwoParticipantsAllowed,

    #[msg("Invalid participant")]
    InvalidParticipant,

    #[msg("Amount not exact")]
    FullfillmentAmountNotExact,
}
