# Solana SPL Escrow Program

This is a program written to ensure safe transfer of SPL Tokens between two parties (Party A & Party B)

### Program Flow

1. Init the escrow submitting the following:
   a. Participant Keys,
   b. Number of Tokens Requested
   c. Associated Token Acccounts of Participant 1
   d. Associated Token Acccount of Participant 2
   e. Bump for the PDA created using a the Public Key of a random Keypair
2. Fullfill the obligation of each participant, with the right amount. And the escrow automaatically transfers the right tokens to the right particiapant
3. Cancel the escrow if a participant requests and refund the tokens

The intention of this program was to use spl-token transfers between PDA's Token Accounts and Associated Token Accounts

Each Escrow Account is a PDA and uses a one time randomly genereated keypair's public key as seed, which needs to be stored by the user to access the escrow account again

### Progress

2 / 3

### TODO

1. Calculate the space for the accounts whiling init'ing
2. Use constraints to validate accounts before transfers
3. Move instruction creation on-chain for security purposes
