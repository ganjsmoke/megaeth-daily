const Web3 = require('web3');
const fs = require('fs');
const web3 = new Web3('https://carrot.megaeth.com/rpc');

// Configuration
const RETRY_CONFIG = {
    maxRetries: 3,
    initialDelay: 30000,
    backoffFactor: 2
};

const PRIVATE_KEY_FILE = 'private_keys.txt';
const CYCLE_INTERVAL = 24 * 60 * 60 * 1000;
const GTE_ROUTER = '0xa6b579684e943f7d00d616a48cf99b5147fc57a5';
const WETH_ADDRESS = '0x776401b9BC8aAe31A685731B7147D4445fD9FB19';
const CHAIN_ID = 6342;
const FIXED_ID = '39584631314667805491088689848282554447608744687563418855093496965842959155466';

const TokenListGTE = [
    '0xFaf334e157175Ff676911AdcF0964D7f54F2C424',
	'0xFaf334e157175Ff676911AdcF0964D7f54F2C424',
	'0xFaf334e157175Ff676911AdcF0964D7f54F2C424',
	'0xFaf334e157175Ff676911AdcF0964D7f54F2C424',
	'0xFaf334e157175Ff676911AdcF0964D7f54F2C424',
	'0xFaf334e157175Ff676911AdcF0964D7f54F2C424',
];

const TokenTestTeko = [
    {
        address: '0x176735870dc6c22b4ebfbf519de2ce758de78d94',
        amount: '1',
        decimals: 18,
        name: 'tkETH'
    },
    {
        address: '0xfaf334e157175ff676911adcf0964d7f54f2c424',
        amount: '2000',
        decimals: 6,
        name: 'tkUSDC'
    },
    {
        address: '0xe9b6e75c243b6100ffcb1c06e8f78f96feea727f',
        amount: '1000',
        decimals: 18,
        name: 'cUSD'
    },
    {
        address: '0xf82ff0799448630eb56ce747db840a2e02cde4d8',
        amount: '0.02',
        decimals: 8,
        name: 'tkWBTC'
    }
];

const erc20ABI = [
    {
        "constant": true,
        "inputs": [
            {"name": "_owner", "type": "address"},
            {"name": "_spender", "type": "address"}
        ],
        "name": "allowance",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {"name": "_spender", "type": "address"},
            {"name": "_value", "type": "uint256"}
        ],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    }
];

// Simplified Print Functions
function printTitle(title) {
    console.log(`\n>> ${title.toUpperCase()}`);
}

function printStep(emoji, message) {
    console.log(`${emoji}  ${message}`);
}

function printSuccess(message) {
    console.log(`✅  ${message}`);
}

function printError(message) {
    console.log(`❌  ${message}`);
}

// Utility Functions
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function randomDelay(min = 60, max = 180) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    printStep('⏳', `Pausing for ${delay}s`);
    return new Promise(resolve => setTimeout(resolve, delay * 1000));
}

async function retryOperation(operation, operationName) {
    let attempt = 1;
    let delay = RETRY_CONFIG.initialDelay;
    
    while (attempt <= RETRY_CONFIG.maxRetries) {
        try {
            return { success: true, data: await operation() };
        } catch (error) {
            // Handle skip requests immediately
            if (error.message.startsWith('SKIP:')) {
                printStep('⏭️', error.message);
                return { success: false, error };
            }
            
            printError(`${operationName} failed (attempt ${attempt}/${RETRY_CONFIG.maxRetries}): ${error.message}`);
            
            if (attempt === RETRY_CONFIG.maxRetries) {
                printError(`Max retries reached for ${operationName}`);
                return { success: false, error };
            }

            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= RETRY_CONFIG.backoffFactor;
            attempt++;
        }
    }
    return { success: false };
}

// Core Operations
async function SwapGTE(privateKey) {
    return retryOperation(async () => {
        printTitle('Initiating GTE Swap');
        
        const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        const walletAddress = account.address;
        const value = web3.utils.toWei(
            (Math.random() * (0.00001 - 0.0000001) + 0.0000001).toFixed(6), 
            'ether'
        );
        const tokenAddress = TokenListGTE[Math.floor(Math.random() * TokenListGTE.length)];
        const tokenName = TokenTestTeko.find(t => t.address === tokenAddress)?.name || 'Unknown Token';
        const deadline = Math.floor(Date.now() / 1000) + 600;

        const transactionData = web3.eth.abi.encodeFunctionCall({
            name: 'swapExactETHForTokens',
            type: 'function',
            inputs: [
                { type: 'uint256', name: 'amountOutMin' },
                { type: 'address[]', name: 'path' },
                { type: 'address', name: 'to' },
                { type: 'uint256', name: 'deadline' }
            ]
        }, ['0', [WETH_ADDRESS, tokenAddress], walletAddress, deadline.toString()]);

        const txParams = {
            from: walletAddress,
            to: GTE_ROUTER,
            value: value,
            data: transactionData,
            chainId: CHAIN_ID,
            nonce: await web3.eth.getTransactionCount(walletAddress, 'pending'),
            gasPrice: await web3.eth.getGasPrice()
        };

        txParams.gas = await web3.eth.estimateGas(txParams);

        printStep('💸', `Swapping ${web3.utils.fromWei(value)} ETH → ${tokenName}`);

        const signedTx = await web3.eth.accounts.signTransaction(txParams, privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        
        printSuccess(`Swap completed: ${receipt.transactionHash}`);
        await randomDelay();
        return receipt;
    }, 'GTE Swap');
}

async function mintTekoTest(privateKey) {
    printTitle('Minting Test Tokens');
    
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    const walletAddress = account.address;
    let successCount = 0;
    let failCount = 0;
	
	const shuffledTokens = shuffleArray([...TokenTestTeko]);

    for (const token of shuffledTokens) {
        const result = await retryOperation(async () => {
            printStep('🛠️', `Attempting ${token.name} mint`);
            
            const amountInUnits = web3.utils.toBN(token.amount)
                .mul(web3.utils.toBN(10).pow(web3.utils.toBN(token.decimals)));

            const transactionData = web3.eth.abi.encodeFunctionCall({
                name: 'mint',
                type: 'function',
                inputs: [
                    { type: 'address', name: 'to' },
                    { type: 'uint256', name: 'amount' }
                ]
            }, [walletAddress, amountInUnits.toString()]);

            const txParams = {
                from: walletAddress,
                to: token.address,
                data: transactionData,
                chainId: CHAIN_ID,
                nonce: await web3.eth.getTransactionCount(walletAddress, 'pending'),
                gasPrice: await web3.eth.getGasPrice()
            };

            txParams.gas = await web3.eth.estimateGas(txParams);
            
            const signedTx = await web3.eth.accounts.signTransaction(txParams, privateKey);
            const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
            return receipt;
        }, `${token.name} Mint`);

        if (result.success) {
            printSuccess(`${token.name} minted (TX: ${result.data.transactionHash})`);
            successCount++;
        } else {
            failCount++;
        }
        
        await randomDelay(10, 30);
    }

    printTitle('Minting Summary');
    console.log(`✅ Success: ${successCount} tokens`);
    console.log(`❌ Failed: ${failCount} tokens`);
    
    return successCount > 0;
}

async function depositTeko(privateKey) {
    return retryOperation(async () => {
        printTitle('Initiating Deposit');
        
        const TEKO_ROUTER = '0x13c051431753fce53eaec02af64a38a273e198d0';
        const tkUSDC_ADDRESS = '0xfaf334e157175ff676911adcf0964d7f54f2c424';
        const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        const walletAddress = account.address;
        const tkUSDC = new web3.eth.Contract(erc20ABI, tkUSDC_ADDRESS);
        const maxApproval = web3.utils.toBN(2).pow(web3.utils.toBN(256)).subn(1);

        // Check balance first
        const balance = await tkUSDC.methods.balanceOf(walletAddress).call();
        if (web3.utils.toBN(balance).isZero()) {
            throw new Error('SKIP: No tkUSDC balance');
        }

        // Proceed with approval check
        const allowance = await tkUSDC.methods.allowance(walletAddress, TEKO_ROUTER).call();
        if (web3.utils.toBN(allowance).lt(maxApproval)) {
            printStep('🔒', 'Approving tokens');
            const approveTx = tkUSDC.methods.approve(TEKO_ROUTER, maxApproval);
            
            const txParams = {
                from: walletAddress,
                to: tkUSDC_ADDRESS,
                data: approveTx.encodeABI(),
                chainId: CHAIN_ID,
                nonce: await web3.eth.getTransactionCount(walletAddress, 'pending'),
                gasPrice: await web3.eth.getGasPrice()
            };

            txParams.gas = await approveTx.estimateGas({ from: walletAddress });
            const signedTx = await web3.eth.accounts.signTransaction(txParams, privateKey);
            await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        }

        // Calculate deposit amount (3% of balance)
        const depositAmount = web3.utils.toBN(balance).muln(3).divn(100);
        
        const transactionData = web3.eth.abi.encodeFunctionCall({
            name: 'deposit',
            type: 'function',
            inputs: [
                { type: 'uint256', name: 'id' },
                { type: 'uint256', name: 'amount' },
                { type: 'address', name: 'to' }
            ]
        }, [FIXED_ID, depositAmount.toString(), walletAddress]);

        const txParams = {
            from: walletAddress,
            to: TEKO_ROUTER,
            data: transactionData,
            chainId: CHAIN_ID,
            nonce: await web3.eth.getTransactionCount(walletAddress, 'pending'),
            gasPrice: await web3.eth.getGasPrice()
        };

        txParams.gas = await web3.eth.estimateGas(txParams);
        
        const signedTx = await web3.eth.accounts.signTransaction(txParams, privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        
        printSuccess(`Deposit completed: ${receipt.transactionHash}`);
        await randomDelay();
        return receipt;
    }, 'Teko Deposit');
}

async function mintCapUSD(privateKey) {
    return retryOperation(async () => {
        printTitle('Minting cUSD');
        
        const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        const walletAddress = account.address;
        const cUSD = TokenTestTeko.find(t => t.name === 'cUSD');
        
        const amountInUnits = web3.utils.toBN(cUSD.amount)
            .mul(web3.utils.toBN(10).pow(web3.utils.toBN(cUSD.decimals)));

        const transactionData = web3.eth.abi.encodeFunctionCall({
            name: 'mint',
            type: 'function',
            inputs: [
                { type: 'address', name: 'to' },
                { type: 'uint256', name: 'amount' }
            ]
        }, [walletAddress, amountInUnits.toString()]);

        const txParams = {
            from: walletAddress,
            to: cUSD.address,
            data: transactionData,
            chainId: CHAIN_ID,
            nonce: await web3.eth.getTransactionCount(walletAddress, 'pending'),
            gasPrice: await web3.eth.getGasPrice()
        };

        txParams.gas = await web3.eth.estimateGas(txParams);
        
        const signedTx = await web3.eth.accounts.signTransaction(txParams, privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        
        printSuccess(`cUSD minted: ${receipt.transactionHash}`);
        await randomDelay();
        return receipt;
    }, 'cUSD Mint');
}

// Wallet Processing
async function processWallet(privateKey) {
    const operations = shuffleArray([
        { name: 'GTE Swap', fn: SwapGTE },
        { name: 'Deposit', fn: depositTeko },
		{ name: 'Mint Teko Token', fn: mintTekoTest },
        { name: 'cUSD Mint', fn: mintCapUSD }
    ]);

    printTitle('Execution Order');
    operations.forEach((op, i) => printStep(`${i + 1}.`, op.name));

    for (const op of operations) {
        const result = await retryOperation(() => op.fn(privateKey), op.name);
        if (!result.success) printStep('⏭️', `Skipped ${op.name}`);
    }
}

async function processWallets() {
    try {
        const privateKeys = fs.readFileSync(PRIVATE_KEY_FILE, 'utf-8')
            .split('\n')
            .map(k => k.trim())
            .filter(k => web3.utils.isHexStrict(k));

        if (!privateKeys.length) throw new Error('No valid private keys found');

        printTitle(`Processing ${privateKeys.length} Wallets`);
        
        for (const [index, key] of privateKeys.entries()) {
            printTitle(`Wallet ${index + 1}/${privateKeys.length}`);
            await processWallet(key);
            await randomDelay(30, 60);
        }
    } catch (error) {
        printError(`Fatal error: ${error.message}`);
    }
}

function printHeader() {
  const line = "=".repeat(50);
  const title = "Auto Daily MegaETH";
  const createdBy = "Bot created by: https://t.me/airdropwithmeh";

  const totalWidth = 50;
  const titlePadding = Math.floor((totalWidth - title.length) / 2);
  const createdByPadding = Math.floor((totalWidth - createdBy.length) / 2);

  const centeredTitle = title.padStart(titlePadding + title.length).padEnd(totalWidth);
  const centeredCreatedBy = createdBy.padStart(createdByPadding + createdBy.length).padEnd(totalWidth);

  console.log(line);
  console.log(centeredTitle);
  console.log(centeredCreatedBy);
  console.log(line);
}

// Main Execution
async function main() {
    while (true) {
        printHeader();
        const cycleStart = Date.now();
        
        await processWallets();
        
        const elapsed = Date.now() - cycleStart;
        const delay = Math.max(CYCLE_INTERVAL - elapsed, 0);
        printStep('⏳', `Next cycle in ${(delay/3600000).toFixed(1)} hours`);
        await new Promise(resolve => setTimeout(resolve, delay));
    }
}

// Start
main().catch(error => {
    printError(`Fatal error: ${error}`);
    process.exit(1);
});