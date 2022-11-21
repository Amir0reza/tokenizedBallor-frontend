import { HttpClient } from "@angular/common/http"
import { Component } from "@angular/core"
import { BigNumber, ethers } from "ethers"

import myERC20TokenJson from "../../../assets/MyERC20Votes.json"
import ballotJson from "../../../assets/TokenizedBallot.json"

declare global {
    interface Window {
        ethereum: any
    }
}

export class eventsClass {
    voter: string
    proposal: string
    amount: string

    constructor(_voter: string, _proposal: string, _amount: string) {
        this.voter = _voter
        this.proposal = _proposal
        this.amount = _amount
    }
}

@Component({
    selector: "app-root",
    templateUrl: "./app.component.html",
    styleUrls: ["./app.component.scss"],
})
export class AppComponent {
    wallet: ethers.Wallet | ethers.providers.JsonRpcSigner | undefined
    walletAddress: string | undefined
    provider:
        | ethers.providers.BaseProvider
        | ethers.providers.Web3Provider
        | undefined
    etherBalance: number | undefined
    ERC20VOTES_ADDRESS: string | undefined
    BALLOT_ADDRESS: string | undefined
    tokenContract: ethers.Contract | undefined
    ballotContract: ethers.Contract | undefined
    tokenBalance: number | undefined
    votingTokens: number | undefined
    votingPower: number | undefined

    metamaskConnected: boolean | undefined
    txHash: string
    blocksRemaining: number
    blocksRemainingStr: string
    winningProposal: string | undefined
    winningVotes: string | undefined

    abiCoder = new ethers.utils.AbiCoder()

    lastFiveEvents: eventsClass[]

    constructor(private http: HttpClient) {
        this.txHash = "0x"
        this.http
            .get<any>("http://localhost:3000/token-address")
            .subscribe((ans) => {
                this.ERC20VOTES_ADDRESS = ans.result
            })
        this.http
            .get<any>("http://localhost:3000/ballot-address")
            .subscribe((ans) => {
                this.BALLOT_ADDRESS = ans.result
            })
        this.blocksRemaining = 0
        this.blocksRemainingStr = "1"
        this.lastFiveEvents = [new eventsClass("0", "0", "0")]
        this.lastFiveEvents.push(new eventsClass("0", "0", "0"))
        this.lastFiveEvents.push(new eventsClass("0", "0", "0"))
        this.lastFiveEvents.push(new eventsClass("0", "0", "0"))
        this.lastFiveEvents.push(new eventsClass("0", "0", "0"))
    }

    createWallet() {
        const localProv = ethers.getDefaultProvider("goerli")
        this.provider = localProv
        this.wallet = ethers.Wallet.createRandom().connect(this.provider)
        this.walletAddress = this.wallet.address
        this.wallet.getBalance().then((balanceBg) => {
            this.etherBalance = parseFloat(ethers.utils.formatEther(balanceBg))
        })

        this.http
            .get<any>("http://localhost:3000/token-address")
            .subscribe((ans) => {
                this.ERC20VOTES_ADDRESS = ans.result
                this.tokenContract = new ethers.Contract(
                    this.ERC20VOTES_ADDRESS!,
                    myERC20TokenJson.abi,
                    this.wallet
                )

                this.tokenContract["balanceOf"](this.walletAddress).then(
                    (balanceBg: BigNumber) => {
                        this.tokenBalance = parseFloat(
                            ethers.utils.formatEther(balanceBg)
                        )
                    }
                )
                this.tokenContract["getVotes"](this.walletAddress).then(
                    (votingTokensBg: BigNumber) => {
                        this.votingTokens = parseFloat(
                            votingTokensBg.toString()
                        )
                    }
                )
            })
        this.http
            .get<any>("http://localhost:3000/ballot-address")
            .subscribe((ans) => {
                this.BALLOT_ADDRESS = ans.result
                this.ballotContract = new ethers.Contract(
                    this.BALLOT_ADDRESS!,
                    ballotJson.abi,
                    this.wallet
                )
                this.ballotContract["targetBlockNumber"]().then(
                    (targetBlockBg: BigNumber) => {
                        localProv.getBlock("latest").then((currentBlockBg) => {
                            const currentBlock = currentBlockBg.number
                            const targetBlock = parseFloat(
                                targetBlockBg.toString()
                            )
                            this.blocksRemaining =
                                targetBlock - currentBlock > 0
                                    ? targetBlock - currentBlock
                                    : 0
                            this.blocksRemainingStr =
                                targetBlock - currentBlock > 0 ? "1" : "0"
                        })
                    }
                )
                this.ballotContract!["votingPower"](this.walletAddress).then(
                    (votingPowerBG: BigNumber) => {
                        this.votingPower = parseFloat(votingPowerBG.toString())
                    }
                )
                this.ballotContract["winnerName"]().then(
                    (winnerStr: string) => {
                        this.winningProposal =
                            ethers.utils.parseBytes32String(winnerStr)
                    }
                )
                this.ballotContract["winningProposal"]().then(
                    (winnerIdx: any) => {
                        this.ballotContract!["proposals"](winnerIdx).then(
                            (winner: any) => {
                                this.winningVotes = winner.voteCount.toString()
                            }
                        )
                    }
                )
            })
    }

    connectMetamask() {
        if (typeof window.ethereum !== "undefined") {
            try {
                const web3Prov = new ethers.providers.Web3Provider(
                    window.ethereum
                )
                this.provider = web3Prov
                const wal = web3Prov.getSigner()
                this.wallet = wal

                this.http
                    .get<any>("http://localhost:3000/token-address")
                    .subscribe((ans) => {
                        this.ERC20VOTES_ADDRESS = ans.result
                        this.tokenContract = new ethers.Contract(
                            ans.result,
                            myERC20TokenJson.abi,
                            wal
                        )
                    })

                this.http
                    .get<any>("http://localhost:3000/ballot-address")
                    .subscribe((ans) => {
                        this.BALLOT_ADDRESS = ans.result
                        this.ballotContract = new ethers.Contract(
                            ans.result,
                            ballotJson.abi,
                            wal
                        )
                        this.ballotContract["targetBlockNumber"]().then(
                            (targetBlockBg: BigNumber) => {
                                web3Prov
                                    .getBlock("latest")
                                    .then((currentBlockBg) => {
                                        const currentBlock =
                                            currentBlockBg.number
                                        const targetBlock = parseFloat(
                                            targetBlockBg.toString()
                                        )
                                        this.blocksRemaining =
                                            targetBlock - currentBlock > 0
                                                ? targetBlock - currentBlock
                                                : 0
                                        this.blocksRemainingStr =
                                            targetBlock - currentBlock > 0
                                                ? "1"
                                                : "0"
                                    })
                            }
                        )
                    })

                wal.getAddress().then((add) => {
                    this.walletAddress = add
                    web3Prov.getBalance(add).then((balanceBg) => {
                        this.etherBalance = parseFloat(
                            ethers.utils.formatEther(balanceBg)
                        )
                    })
                    if (this.ERC20VOTES_ADDRESS) {
                        this.tokenContract!["balanceOf"](add).then(
                            (balanceBg: BigNumber) => {
                                this.tokenBalance = parseFloat(
                                    ethers.utils.formatEther(balanceBg)
                                )
                            }
                        )
                        this.tokenContract!["getVotes"](add).then(
                            (votingTokensBg: BigNumber) => {
                                this.votingTokens = parseFloat(
                                    votingTokensBg.toString()
                                )
                            }
                        )
                    }
                    if (this.BALLOT_ADDRESS) {
                        this.ballotContract!["votingPower"](
                            this.walletAddress
                        ).then((votingPowerBG: BigNumber) => {
                            this.votingPower = parseFloat(
                                votingPowerBG.toString()
                            )
                        })
                        this.ballotContract!["winnerName"]().then(
                            (winnerStr: string) => {
                                this.winningProposal =
                                    ethers.utils.parseBytes32String(winnerStr)
                            }
                        )
                        this.ballotContract!["winningProposal"]().then(
                            (winnerIdx: any) => {
                                this.ballotContract!["proposals"](
                                    winnerIdx
                                ).then((winner: any) => {
                                    this.winningVotes =
                                        winner.voteCount.toString()
                                })
                            }
                        )
                    }
                })
            } catch (error) {
                console.log(error)
            }
            this.metamaskConnected = true
        } else {
            console.log("Error connecting to metamask !!!")
        }
    }

    requestToken() {
        this.http
            .get<any>("http://localhost:3000/token-request-counter")
            .subscribe((ans) => {
                const counterTokenRequest = ans.result
                const messageHash = ethers.utils.keccak256(
                    this.abiCoder.encode(
                        ["address", "uint256"],
                        [this.walletAddress, counterTokenRequest]
                    )
                )
                this.wallet?.signMessage(messageHash).then((signature) => {
                    const sendData = {
                        to: this.walletAddress,
                        counter: counterTokenRequest.toString(),
                        signature: signature,
                    }

                    this.http
                        .post<any>(
                            "http://localhost:3000/request-tokens",
                            sendData
                        )
                        .subscribe((ans) => {
                            console.log(ans.result)

                            // this.listenForTransactionToMine(
                            //     ans.result,
                            //     this.provider!
                            // ).then(() => {})
                        })
                })
            })
    }

    vote(proposalId: string, voteAmount: string) {
        console.log(`Trying to vote ${voteAmount} times for ${proposalId}`)
        this.ballotContract!["vote"](proposalId, voteAmount).then(
            (txResponse: ethers.providers.TransactionResponse) => {
                this.listenForTransactionToMine(
                    txResponse,
                    this.provider!
                ).then(() => {})
            }
        )
    }

    voteWithPermit(proposalId: string, voteAmount: string) {
        console.log(`Trying to vote ${voteAmount} times for ${proposalId}`)

        this.ballotContract!["permit"](proposalId, voteAmount).then(
            (txResponse: ethers.providers.TransactionResponse) => {
                this.listenForTransactionToMine(
                    txResponse,
                    this.provider!
                ).then(() => {})
            }
        )
    }

    delegateVote(account: string) {
        console.log(`Trying to delegate votes to ${account}`)
        this.tokenContract!["delegate"](account).then(
            (txResponse: ethers.providers.TransactionResponse) => {
                this.listenForTransactionToMine(
                    txResponse,
                    this.provider!
                ).then(() => {})
            }
        )
    }

    listenForTransactionToMine(
        transactionResponce: ethers.ContractTransaction,
        provider: ethers.providers.BaseProvider | ethers.providers.Web3Provider
    ): Promise<any> {
        this.txHash = transactionResponce.hash
        console.log(`Mining ${transactionResponce.hash}`)
        return new Promise<any | void>((resolve, reject) => {
            provider.once(
                transactionResponce.hash,
                (transactionreceipt: ethers.ContractReceipt) => {
                    console.log(
                        `Completed with ${transactionreceipt.confirmations} confirmations`
                    )

                    console.log(transactionreceipt);
                    
                    const eventVoter = "0x" + transactionreceipt.logs[0].topics[1].slice(26, 66)
                    console.log(eventVoter);
                    
                    const eventProposal = "'" + transactionreceipt.logs[0].topics[2].slice(-4, 66) + "'" 
                    const eventAmount = "'" + transactionreceipt.logs[0].topics[3].slice(-4, 66) + "'"

                    console.log(eventProposal)
                    console.log(eventAmount);
                    
                    
                    this.lastFiveEvents.push(
                        new eventsClass(
                            eventVoter,
                            eventProposal,
                            eventAmount
                        )
                    )
                    console.log(this.lastFiveEvents)

                    if (this.lastFiveEvents.length > 5) {
                        this.lastFiveEvents.shift()
                    }
                    this.txHash = "0x"
                    resolve(transactionreceipt)
                }
            )
        })
    }
}
