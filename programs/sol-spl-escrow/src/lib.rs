use anchor_lang::prelude::*;
use anchor_spl::token::{ Mint, Token, TokenAccount};

mod errors;
mod ix;

pub use ix::*;

declare_id!("HFXevJNQjGqLhapmUhj8oEetrsc5iGBGBQJsm7aUGTAZ");

#[program]
pub mod sol_spl_escrow {
    use std::vec;

    use anchor_lang::solana_program::program::invoke_signed;

    use super::*;

    /// Create the escrow account for transactions
    pub fn create_escrow(
        ctx: Context<CreateEscrow>,
        participants: Vec<Pubkey>,
        amounts: Vec<u64>,
        from_keys: Vec<Pubkey>,
        to_keys: Vec<Pubkey>,
        bump: u8,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(
            participants.len() == 2 && amounts.len() == 2 &&
            from_keys.len() ==2 && to_keys.len() ==2,
            errors::Errors::ExactlyTwoParticipantsAllowed
        );

        escrow.base = ctx.accounts.base.key();
        escrow.bump = bump;
        escrow.participants = participants;
        escrow.required_amounts = amounts;
        escrow.is_approved = vec![false; 2];
        escrow.token_accounts = vec![None; 2];
        escrow.is_executed = false;
        escrow.from_keys = from_keys;
        escrow.to_keys = to_keys;
        Ok(())
    }

    /// Create a token account for the escrow PDA
    /// Doesn't execute any instructions
    pub fn create_token_account(ctx: Context<CreateTokenAccount>) -> Result<()> {
        let position = ctx.accounts.escrow.participants
        .iter()
        .position(|x| x.key() == ctx.accounts.signer.key());

        // Make sure that signer is a participant
        require!(position != None, errors::Errors::InvalidParticipant);

        // // Update the escrow with the token account address
        let escrow = &mut ctx.accounts.escrow;
        let index = position.unwrap();
        escrow.token_accounts[index] = Some(ctx.accounts.token_account.key());
        msg!("New ATA for the escrow account created");

        Ok(())
    }

    /// Fullfill the obligation of the escrow transfer
    /// Scenirios:
    /// a. Transfer Token A from Account A to Escrow PDA
    /// b. Transfer Token B from Account B to Escrow PDA
    /// in both cases, if both cases are satisfied, transfer 
    /// a. Token A from Escrow PDA to Account A
    /// b. Token B from Escrow PDA to Account B
    pub fn fullfill(ctx: Context<ExecuteTransferInstruction>, ix: TXInstruction,  amount: u64) -> Result<()> {
        let escrow =  &mut ctx.accounts.escrow;
        let position = escrow.participants
        .iter()
        .position(|x| x.key() == ctx.accounts.authority.key());
        // Make sure that signer is a participant
        require!(position != None, errors::Errors::InvalidParticipant);
        // FIXME: Currently there is not proper way to ensure that amount passed in the instruction is the same as the amount passed in the parameter
        require!(amount == escrow.required_amounts[position.unwrap()],errors::Errors::FullfillmentAmountNotExact );
        escrow.is_approved[position.unwrap()] = true;

        let seed: &[&[&[u8]]] = &[&[
            escrow.base.as_ref(),
            &[escrow.bump],
        ]];
        invoke_signed(
            &ix.to_ix(),
            &[
                ctx.accounts.authority.to_account_info(),
                ctx.accounts.to_account.to_account_info(),
                ctx.accounts.from_account.to_account_info(),
            ],
            &seed,
        )?;
        escrow.is_approved[position.unwrap()] = true;

        let position = escrow.is_approved.iter().position(|&x| x == false);
        if position == None {
            // This means that the txn is approved and we can transfer the funds to the right owners
            msg!("FULLFILLED - {:?}", escrow.is_approved);
        }
        else {
            msg!("One more to go - {:?}", escrow.is_approved);
        }

        Ok(())
    }
}

/// Handy struct for boilerplating
#[derive(Accounts)]
pub struct NoAccounts {}

/// Accounts for initiating the Escrow Transaction
#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct CreateEscrow<'info> {
    #[account(mut)]
    base: Signer<'info>,
    #[account(init, seeds = [base.key().as_ref()], bump, payer = signer, space = 1000)]
    escrow: Account<'info, Escrow>,
    #[account(mut)]
    signer: Signer<'info>,
    system_program: Program<'info, System>,
}

/// Accounts for creating an Associated Token Account for the Escrow PDA
#[derive(Accounts)]
pub struct CreateTokenAccount<'info> {
    #[account(mut)]
    signer: Signer<'info>,
    #[account(mut)]
    escrow: Account<'info, Escrow>,
    #[account()]
    mint_account: Account<'info, Mint>,
    #[account(
        init,
        payer = signer,
        seeds = [escrow.key().as_ref(), mint_account.key().as_ref()],
        bump,
        token::mint = mint_account,
        token::authority = escrow 
        )] 
    token_account: Account<'info, TokenAccount>,
    token_program: Program<'info, Token>,
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>
}

/// Accounts for executing a transfer instruction
#[derive(Accounts)]
pub struct ExecuteTransferInstruction<'info> {
    /// CHECK: TOOD: Add constraints
    #[account(mut)]
    from_account: AccountInfo<'info>,
    /// CHECK: TOOD: Add constraints
    #[account(mut)]
    to_account: AccountInfo<'info>,
    #[account(mut)]
    authority: Signer<'info>,
    token_program: Program<'info, Token>,
    #[account(mut)]
    escrow: Account<'info, Escrow>,
}

#[account]
pub struct Escrow {
    // Base Key to derive the PDA from
    base: Pubkey, 
    // Seed Bump
    bump: u8,
    // They Public Keys of the participants
    participants: Vec<Pubkey>,
    // The from keys of the participants
    from_keys: Vec<Pubkey>,
    // The to keys of the participants
    to_keys: Vec<Pubkey>,
    // The amounts obligated to fullfill
    required_amounts: Vec<u64>,
    // Associated Token Account public keys for transfers
    token_accounts: Vec<Option<Pubkey>>,
    // Approvals as transferred to the escrow
    is_approved: Vec<bool>,
    // Is executed
    is_executed: bool,
}
