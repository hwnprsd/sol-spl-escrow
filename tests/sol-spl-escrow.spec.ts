import * as anchor from "@project-serum/anchor";
import { Program, BN } from "@project-serum/anchor";
import { assert, expect } from "chai";
import {
  Account,
  AuthorityType,
  createMint,
  createTransferCheckedInstruction,
  createTransferInstruction,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  setAuthority,
  TOKEN_PROGRAM_ID,
  transfer,
  transferChecked,
} from "@solana/spl-token";
import { SolSplEscrow } from "../target/types/sol_spl_escrow";
import { Accounts } from "./keys";
import { invoke } from "@project-serum/anchor/dist/cjs/utils/rpc";
import { token } from "@project-serum/anchor/dist/cjs/utils";
import { findProgramAddressSync } from "@project-serum/anchor/dist/cjs/utils/pubkey";
const { PublicKey, Keypair, SystemProgram } = anchor.web3;

describe("High Key Escrow", async () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SolSplEscrow as Program<SolSplEscrow>;
  const baseKey = Keypair.generate();

  const [escrowAddress, escrowBump] = await PublicKey.findProgramAddress(
    [baseKey.publicKey.toBuffer()],
    program.programId
  );

  let escrowTokenAccountAddressA: anchor.web3.PublicKey,
    escrowTokenAccountBumpA: number;
  let escrowTokenAccountAddressB: anchor.web3.PublicKey,
    escrowTokenAccountBumpB: number;

  let mintAddressA: anchor.web3.PublicKey, mintAddressB: anchor.web3.PublicKey;
  let tokenAAccountA: Account, tokenBAccountB: Account;
  let tokenBAccountA: Account, tokenAAccountB: Account;

  // Get or create token account
  let getTokenAccount = (
    address: anchor.web3.PublicKey,
    mintAddress: anchor.web3.PublicKey
  ) =>
    getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      Accounts.owner1,
      mintAddress,
      address
    );

  // Get account data
  let getAccountData = (address: anchor.web3.PublicKey) =>
    getAccount(program.provider.connection, address);

  before(async () => {
    mintAddressA = await createMint(
      program.provider.connection,
      Accounts.mintOwner,
      Accounts.mintOwner.publicKey,
      Accounts.mintOwner.publicKey,
      6
    );
    mintAddressB = await createMint(
      program.provider.connection,
      Accounts.mintOwner,
      Accounts.mintOwner.publicKey,
      Accounts.mintOwner.publicKey,
      6
    );

    tokenAAccountA = await getOrCreateAssociatedTokenAccount(
      program.provider.connection, // Connection
      Accounts.owner1,
      mintAddressA,
      Accounts.owner1.publicKey
    );
    tokenAAccountB = await getOrCreateAssociatedTokenAccount(
      program.provider.connection, // Connection
      Accounts.owner1,
      mintAddressA,
      Accounts.owner2.publicKey
    );
    tokenBAccountB = await getOrCreateAssociatedTokenAccount(
      program.provider.connection, // Connection
      Accounts.owner1,
      mintAddressB,
      Accounts.owner2.publicKey
    );
    tokenBAccountA = await getOrCreateAssociatedTokenAccount(
      program.provider.connection, // Connection
      Accounts.owner1,
      mintAddressB,
      Accounts.owner1.publicKey
    );
    const sg1 = await program.provider.connection.requestAirdrop(
      Accounts.owner1.publicKey,
      10000000000
    );
    const sg2 = await program.provider.connection.requestAirdrop(
      Accounts.owner2.publicKey,
      10000000000
    );
    await program.provider.connection.confirmTransaction(sg1);
    await program.provider.connection.confirmTransaction(sg2);
    console.log("Owner 1 Public Key", Accounts.owner1.publicKey.toString());
    console.log("Owner 2 Public Key", Accounts.owner2.publicKey.toString());
    console.log("PDA Key", escrowAddress.toString());
    console.log(
      "Mint Owner Public Key",
      Accounts.mintOwner.publicKey.toString()
    );
    console.log("Mint Address", mintAddressA.toString());

    [escrowTokenAccountAddressA, escrowTokenAccountBumpA] =
      findProgramAddressSync(
        [escrowAddress.toBuffer(), mintAddressA.toBuffer()],
        program.programId
      );
    [escrowTokenAccountAddressB, escrowTokenAccountBumpB] =
      findProgramAddressSync(
        [escrowAddress.toBuffer(), mintAddressB.toBuffer()],
        program.programId
      );
  });

  it("Create Escrow!", async () => {
    const tx = await program.methods
      .createEscrow(
        [Accounts.owner1.publicKey, Accounts.owner2.publicKey],
        [new BN(10), new BN(10)],
        [tokenAAccountA.address, tokenBAccountB.address], // Order is important
        [tokenBAccountA.address, tokenAAccountB.address],
        escrowBump
      )
      .accounts({
        escrow: escrowAddress,
        systemProgram: SystemProgram.programId,
        signer: Accounts.owner1.publicKey,
        base: baseKey.publicKey,
      })
      .signers([baseKey, Accounts.owner1])
      .rpc();
    console.log("Your transaction signature", tx);
  });

  // Setup the tokens and token owners
  it("Mint tokens to owners", async () => {
    const { connection } = program.provider; // Connection

    await mintTo(
      connection, // Connection
      Accounts.owner1, // Fee Payer
      mintAddressA, // Mint Account Public Key
      tokenAAccountA.address, // Token Account to Mint to
      Accounts.mintOwner, // Mint Account Owner
      1e4
    );

    await mintTo(
      connection, // Connection
      Accounts.owner1, // Fee Payer
      mintAddressB, // Mint Account Public Key
      tokenBAccountB.address, // Token Account to Mint to
      Accounts.mintOwner, // Mint Account Owner
      1e4
    );

    const acc = await getAccount(connection, tokenAAccountA.address);
    assert(acc.amount.toString() === (1e4).toString(), "Amounts don't match");
    console.log("Amount", acc.amount.toString());
  });

  it("Should create token accounts for Participants", async () => {
    await program.methods
      .createTokenAccount()
      .accounts({
        signer: Accounts.owner2.publicKey,
        escrow: escrowAddress,
        mintAccount: mintAddressB,
        tokenAccount: escrowTokenAccountAddressB,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([Accounts.owner2])
      .rpc();
    await program.methods
      .createTokenAccount()
      .accounts({
        signer: Accounts.owner1.publicKey,
        escrow: escrowAddress,
        mintAccount: mintAddressA,
        tokenAccount: escrowTokenAccountAddressA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([Accounts.owner1])
      .rpc();
    const escrow = await program.account.escrow.fetch(escrowAddress);
    assert(
      escrow.tokenAccounts[0] !== null || escrow.tokenAccounts[1] !== null
    );
  });

  it("should fullfill Owner A's obligation", async () => {
    const ix = createTransferInstruction(
      tokenAAccountA.address,
      escrowTokenAccountAddressA,
      Accounts.owner1.publicKey,
      10
    );
    const res = await program.methods
      .fullfill(ix, new BN(10))
      .accounts({
        fromAccount: tokenAAccountA.address,
        toAccount: escrowTokenAccountAddressA,
        authority: Accounts.owner1.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        escrow: escrowAddress,
      })
      .signers([Accounts.owner1])
      .rpc();
  });

  it("should fullfill Owner B's obligation", async () => {
    const ix = createTransferInstruction(
      tokenBAccountB.address,
      escrowTokenAccountAddressB,
      Accounts.owner2.publicKey,
      10
    );
    const res = await program.methods
      .fullfill(ix, new BN(10))
      .accounts({
        fromAccount: tokenBAccountB.address,
        toAccount: escrowTokenAccountAddressB,
        authority: Accounts.owner2.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        escrow: escrowAddress,
      })
      .signers([Accounts.owner2])
      .rpc();
  });
});
