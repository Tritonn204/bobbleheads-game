import { useState, useEffect } from 'react';
import logo from './logo.svg';
import './App.css';
import { Game, OnlineGame } from './Game.js';
import { ethers } from 'ethers';
import { ReferenceDataContext } from "./ReferenceDataContext";

import socketIOClient from "socket.io-client";

//SERVER URL
const ENDPOINT = "https://bobbleheads-server-dj54i.ondigitalocean.app";
//const ENDPOINT = "http://localhost:4001";
const HOST = "https://bobbleheads-server-dj54i.ondigitalocean.app";
//const HOST = "http://localhost:"

// Web pages
const RPCURL = "https://rpc.ankr.com/fantom";
const NETWORK = 250;

function App() {
    const [server, newServer] = useState();
    const [status, setStatus] = useState(0);

    const [matches, setMatches] = useState([]);
    const [gameId, setGameId] = useState();

    const [currentAccount, setCurrentAccount] = useState();
	const [wallet, setWallet] = useState(window.ethereum);
	const [provider, newProvider] = useState(new ethers.providers.Web3Provider(wallet, "any"));
    const [initialData, setInitialData] = useState();
	// const ftmProvider = new ethers.providers.JsonRpcProvider("https://rpc.ftm.tools");
	// const readSigner = new ethers.Wallet('0xefa25f6af0f03a651494731e7a3bcfaae02607b50cf9efe0477a9dc77da9aafd', ftmProvider);
	// const [nftContract, newNftContract] = useState(new ethers.Contract(NFTAddress, NFTABI, readSigner));
	// const [gameContract, newGameContract] = useState(new ethers.Contract(NFTAddress, NFTABI, provider.getSigner(0)));

    const context = {
        server,
        currentAccount,
        gameId
    }

    const correctChain = async () => {
		try {
			await wallet.request({
				method: 'wallet_switchEthereumChain',
				params: [{ chainId: ('0x' + NETWORK.toString(16)) }], // chainId must be in hexadecimal numbers
			});
		} catch (error) {
			// This error code indicates that the chain has not been added to MetaMask
			// if it is not, then install it into the user MetaMask
			if (error.code === 4902) {
				try {
					await wallet.request({
						method: 'wallet_addEthereumChain',
						params: [
							{
								chainId: ('0x' + NETWORK.toString(16)),
								rpcUrl: RPCURL,
							},
						],
					});
				} catch (addError) {
					console.error(addError);
				}
			}
			console.error(error);
		}
	}

	const connectWalletHandler = async () => {
		const _newAccount = await wallet.request({ method: 'eth_requestAccounts' });
		newProvider(new ethers.providers.Web3Provider(wallet, "any"));
		// newNFTContract(new ethers.Contract(NFTAddress, NFTABI, provider.getSigner(0)));
		// newLockSendContract(new ethers.Contract(lockerAddress, lockerABI, provider.getSigner(0)));
		setCurrentAccount(_newAccount[0]);
		getTokens(_newAccount[0]);
        server.emit('setWallet', _newAccount[0]);
        await server.emit('getGameId', async(id) => {
            setGameId(id);
        })
	}



	const addListeners = async (socket) => {
		provider.on('network', async (newNetwork, oldNetwork) => {
			correctChain();
		});

        socket.on("connect_error", (err) => {
          console.log(`connect_error due to ${err.message}`);
        });

        socket.on('createGame', () => {
            getMatches(socket);
        });

        wallet.on('accountsChanged', async (_newAccount, _oldAccount) => {
			setCurrentAccount(_newAccount[0]);
			getTokens(_newAccount[0]);
		});
	}

	const getTokens = async (account) => {
		// const owned = await NFTContract.isApprovedForAll(account, lockerAddress);
		// setApproval(owned);
	}

	useEffect(() => {
        newProvider(new ethers.providers.Web3Provider(wallet, "any"));
        setWallet(window.ethereum);
        if (window.ethereum.accounts)
            server.emit('setWallet', window.ethereum.accounts[0]);

        const server = socketIOClient(ENDPOINT);
        getMatches(server);
		addListeners(server);
        newServer(server);

		getTokens();
	}, [])

    const getMatches = async (socket) => {
        socket.emit('getGameId', (id) => {
            setGameId(id);
        })

        socket.emit('fetchMatches', (matches) => {
            setMatches(matches);
        });
    }

	const connectWalletButton = () => {
		if (currentAccount) {
			return (
				<button className='cta-button responsive clickShrink'> {currentAccount.substring(0, 6) + "..." + currentAccount.slice(-4)}</button>
			)
		} else {
			return (
				<button className='cta-button responsive clickShrink' onClick={() => { correctChain(); connectWalletHandler() }}>Connect Wallet</button>
			)
		}
	}

    const createRoomButton = () => {
		if (currentAccount && !gameId) {
			return (
				<button className='cta-button responsive clickShrink' onClick={createLobby}>Create Lobby</button>
			)
		}
	}

    const createLobby = async () => {
        await server.emit('requestGame', async (id) => {
            await server.emit('createGame', id, () => {
                setStatus(1);
            });
        })
    }

    const joinLobby = async (id) => {
        server.emit('fetchGamePort', id, (port) => {
            server.disconnect();
            const matchServer = socketIOClient(HOST + ':' + port);
            matchServer.emit('setWallet', currentAccount);
            newServer(matchServer);
            matchServer.emit('joinGame', id, () => {
                setStatus(1);
            });
        });
    }

    const leaveLobby = (id) => {
        server.emit('leaveGame', id, () => {
            server.emit('fetchMatches', (matches) => {
                setMatches(matches);
                setGameId(null);
            });
        });
    }

    const enterButtons = () => {
        if (currentAccount) {
            if(!gameId){
                return (
                    <>
                        {matches.map(match => (
                            <button key={match} className='cta-button responsive clickShrink' onClick={() => joinLobby(match)}>#{match}</button>
                        ))}
                    </>
                )
            } else {
                return (
                    <>
                        <button className='cta-button responsive clickShrink' onClick={() => joinLobby(gameId)}>Rejoin Game</button>
                        <button className='cta-button responsive clickShrink' onClick={() => leaveLobby(gameId)}>Leave Game</button>
                    </>
                )
            }
    	}
    }

    const roomHeader = () => {
        if (currentAccount){
            if (gameId) {
                return <>You are Currently in a Game...</>
            }
            return <>{matches.length > 0 ? 'Join Rooms...' : ''}</>
        }
    }

    const getScreen = () => {
        switch(status) {
            case 0:
                return(
                    <div className="App-header">
                    <h1>BOBBLEHEADS BRAWL ALPHA</h1>
                    {connectWalletButton()}
                    {createRoomButton()}
                    <h3>{roomHeader()}</h3>
                    <div className = 'multiplayerButtons'>
                        {enterButtons()}
                    </div>
                    </div>
                )
                break;
            case 1:
                return(
                    <div className='game'>
                        <OnlineGame />
                    </div>
                )
                break;
        }
    }

    return (
        <ReferenceDataContext.Provider value={context}>
            <div>
                {getScreen()}
            </div>
        </ReferenceDataContext.Provider>
  );
}

export default App;
