# Solana SPL Escrow Program

This is a program written to ensure safe transfer of SPL Tokens between two parties (Party A & Party B)

### Program Flow

1. Init the escrow submitting the following:
   1. Public Keys of both parties
   2. Number of Tokens Requested
   3. Associated Token Acccounts of Party A
   4. Associated Token Acccount of Party B
   5. Bump for the PDA created using a the Public Key of a random Keypair
2. Fullfill the obligation of each party, with the right amount. And the escrow automaatically transfers the right tokens to the right party
3. Cancel the escrow if a party requests and refund the tokens

The intention of this program was to use spl-token transfers between PDA's Token Accounts and Associated Token Accounts

Each Escrow Account is a PDA and uses a one time randomly genereated keypair's public key as seed, which needs to be stored by the user to access the escrow account again

### Progress

2 / 3

### TODO

1. Calculate the space for the accounts whiling init'ing
2. Use constraints to validate accounts before transfers
3. Move instruction creation on-chain for security purposes
