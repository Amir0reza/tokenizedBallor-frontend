import { Component } from "@angular/core"
import { BigNumber, ethers } from "ethers"

import myERC20TokenJson from "../../../assets/MyERC20Votes.json"
import ballotJson from "../../../assets/TokenizedBallot.json"
import contract_addresses from "../../../contract-addresses.json"

const ERC20VOTES_ADDRESS = contract_addresses.ERC20VOTES_ADDRESS
const BALLOT_ADDRESS = contract_addresses.BALLOT_ADDRESS

declare global {
    interface Window {
        ethereum: any
    }
}

export class RequestTokensDTO {
    "to": string
    "counter": string
    "signature": string

    constructor(_to: string, _counter: string, _signature: string) {
        this.to = _to
        this.counter = _counter
        this.signature = _signature
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
    tokenContract: ethers.Contract | undefined
    ballotContract: ethers.Contract | undefined
    tokenBalance: number | undefined
    votingPower: number | undefined

    metamaskConnected: boolean | undefined
    txHash: string

    counterTokenRequest: number

    abiCoder = new ethers.utils.AbiCoder()

    constructor() {
        this.txHash = "0x"
        this.counterTokenRequest = 0
    }

    createWallet() {
        this.provider = ethers.getDefaultProvider("goerli")
        this.wallet = ethers.Wallet.createRandom().connect(this.provider)
        this.walletAddress = this.wallet.address
        this.wallet.getBalance().then((balanceBg) => {
            this.etherBalance = parseFloat(ethers.utils.formatEther(balanceBg))
        })
        this.tokenContract = new ethers.Contract(
            ERC20VOTES_ADDRESS,
            myERC20TokenJson.abi,
            this.provider
        )
        this.ballotContract = new ethers.Contract(
            BALLOT_ADDRESS,
            ballotJson.abi,
            this.provider
        )
        this.tokenContract["balanceOf"](this.wallet.address).then(
            (balanceBg: BigNumber) => {
                this.tokenBalance = parseFloat(
                    ethers.utils.formatEther(balanceBg)
                )
            }
        )
        this.tokenContract["getVotes"](this.wallet.address).then(
            (votingPowerBg: BigNumber) => {
                this.votingPower = parseFloat(
                    ethers.utils.formatEther(votingPowerBg)
                )
            }
        )
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
                this.tokenContract = new ethers.Contract(
                    ERC20VOTES_ADDRESS,
                    myERC20TokenJson.abi,
                    this.provider
                )
                this.ballotContract = new ethers.Contract(
                    BALLOT_ADDRESS,
                    ballotJson.abi,
                    this.provider
                )
                wal.getAddress().then((add) => {
                    this.walletAddress = add
                    web3Prov.getBalance(add).then((balanceBg) => {
                        this.etherBalance = parseFloat(
                            ethers.utils.formatEther(balanceBg)
                        )
                    })
                    this.tokenContract!["balanceOf"](add).then(
                        (balanceBg: BigNumber) => {
                            this.tokenBalance = parseFloat(
                                ethers.utils.formatEther(balanceBg)
                            )
                        }
                    )
                    this.tokenContract!["getVotes"](add).then(
                        (votingPowerBg: BigNumber) => {
                            this.votingPower = parseFloat(
                                votingPowerBg.toString()
                            )
                        }
                    )
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
        this.counterTokenRequest += 1
        const messageHash = ethers.utils.keccak256(
            this.abiCoder.encode(
                ["address", "uint256"],
                [this.walletAddress, this.counterTokenRequest]
            )
        )
        this.wallet?.signMessage(messageHash).then((signature) => {
            const sendData = new RequestTokensDTO(
                this.walletAddress!,
                this.counterTokenRequest.toString(),
                signature
            )
            console.log(sendData)
        })
    }

    vote(proposalId: string, voteAmount: string) {
        if (typeof this.provider !== "undefined") {
            console.log(`Trying to vote ${voteAmount} times for ${proposalId}`)
            this.ballotContract!.connect(this.wallet!)
                ["vote"](proposalId, voteAmount)
                .then((txResponse: ethers.providers.TransactionResponse) => {
                    this.listenForTransactionToMine(
                        txResponse,
                        this.provider!
                    ).then(() => {})
                })
        }
    }

    listenForTransactionToMine(
        transactionResponce: ethers.providers.TransactionResponse,
        provider: ethers.providers.BaseProvider | ethers.providers.Web3Provider
    ): Promise<void> {
        this.txHash = transactionResponce.hash
        console.log(`Mining ${transactionResponce.hash}`)
        return new Promise<void>((resolve, reject) => {
            provider.once(
                transactionResponce.hash,
                (transactionreceipt: ethers.providers.TransactionReceipt) => {
                    console.log(
                        `Completed with ${transactionreceipt.confirmations} confirmations`
                    )
                    this.txHash = "0x"
                    resolve()
                }
            )
        })
    }
}
