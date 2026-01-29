# BerryPay

Nano (XNO) cryptocurrency wallet CLI designed for AI agents and automated payment processing.

## Features

- **No passwords** - Designed for automation, no interactive prompts
- **Environment variables** - Configure via `BERRYPAY_SEED` for AI agents
- **JSON output** - All commands output JSON for easy parsing
- **Payment processor** - Ephemeral addresses, auto-sweep to main wallet
- **Real-time** - WebSocket-based payment confirmations
- **Persistent** - Charges survive restarts

## Installation

```bash
npm install -g berrypay
```

## Quick Start

```bash
# Create wallet (no password, stored in ~/.berrypay/)
berrypay init

# Or use environment variable (for AI agents)
export BERRYPAY_SEED=your64charhexseed

# Show address
berrypay address

# Check balance
berrypay balance

# Send XNO (use --yes to skip confirmation)
berrypay send nano_1abc... 0.1 --yes

# Receive pending
berrypay receive
```

## Environment Variables

```bash
BERRYPAY_SEED      # 64-char hex seed (overrides config file)
BERRYPAY_RPC_URL   # RPC node URL
BERRYPAY_WS_URL    # WebSocket URL
```

## Payment Processor

Accept payments with auto-generated ephemeral addresses:

```bash
# Create a charge
berrypay charge create 0.5
# Returns: { id, address, amount, expiresAt }

# Listen for payments (runs continuously)
berrypay charge listen

# Check status
berrypay charge status chg_abc123

# List all charges
berrypay charge list
```

### Flow

```
1. charge create 1.0  →  Ephemeral address generated
2. Customer pays      →  WebSocket detects payment
3. Auto-receive       →  Pending blocks received
4. Auto-sweep         →  Funds sent to main wallet (index 0)
5. Cleanup            →  Ephemeral address tracking removed
```

## All Commands

```bash
berrypay init                    # Create new wallet
berrypay import <seed>           # Import from seed
berrypay address [--qr]          # Show address
berrypay balance [--json]        # Check balance
berrypay send <addr> <amt> [-y]  # Send XNO
berrypay receive                 # Receive pending
berrypay watch                   # Watch for payments
berrypay export                  # Show seed
berrypay delete [-y]             # Delete wallet
berrypay config                  # Show/set config

berrypay charge create <amt>     # Create charge
berrypay charge listen           # Listen for payments
berrypay charge status <id>      # Check charge
berrypay charge list             # List charges
berrypay charge cleanup          # Remove swept charges
```

## Programmatic Usage

```typescript
import { BerryPayWallet, PaymentProcessor } from 'berrypay';

const wallet = new BerryPayWallet({ seed: process.env.BERRYPAY_SEED });

// Send
await wallet.send('nano_1...', BerryPayWallet.nanoToRaw('0.1'));

// Payment processor
const processor = new PaymentProcessor({ wallet, autoSweep: true });
processor.on('charge:completed', (charge) => console.log('Paid!', charge.id));
await processor.start();

const charge = await processor.createCharge({ amountNano: '1.0' });
// charge.address - send payment here
```

## Storage

- Config: `~/.berrypay/config.json`
- Charges: `~/.berrypay/charges.json`

## License

MIT
