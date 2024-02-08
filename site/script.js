class LineTCompactSocket {
    constructor(gwPath, authToken, device) {
        this.socket = {}
        this.socketInfo = {}
        let appVer, sysName, sysVer, UA, appName;
        sysVer = "12.1.4"
        switch (device) {
            case "DESKTOPWIN":
                appVer = "7.16.1.3000"
                sysName = "WINDOWS"
                sysVer = "10.0.0-NT-x64"
                break;
            case "DESKTOPMAC":
                appVer = "7.16.1.3000"
                sysName = "MAC"
                break;
            case "CHROMEOS":
                appVer = "3.0.3"
                sysName = "Chrome_OS"
                sysVer = "1"
                break;
            case "ANDROID":
                appVer = "13.4.1"
                sysName = "Android OS"
                break;
            case "IOS":
                appVer = "13.3.0"
                sysName = "iOS"
                break;
            case "IOSIPAD":
                appVer = "13.3.0"
                sysName = "iOS"
                break;
            case "WATCHOS":
                appVer = "13.3.0"
                sysName = "Watch OS"
                break;
            case "WEAROS":
                appVer = "13.4.1"
                sysName = "Wear OS"
                break;
            default:
                return new Error("device name is wrong")
                break;
        }
        appName = device + "\t" + appVer + "\t" + sysName + "\t" + sysVer
        UA = "Line/" + appVer
        let account = { path: gwPath, auth: authToken, ua: UA, type: appName }
        this.socket.post = new WebSocket("wss://line-selfbot.deno.dev/post?" + new URLSearchParams(account).toString())
        this.socket.post.onopen = (e) => {
            this.socketInfo.post = { status: "open", waitFunc: {} }
        };
        this.socket.post.onclose = (e) => {
            this.socketInfo.post.status = false
        };
        this.socket.post.onmessage = null
        this.socket.post.onclose = (e) => {
            this.socketInfo.post = { status: false }
        };
    }
    closeSocket() {
        try {
            this.socket.post.close()
        } catch (e) {
        }
    }
    post(data) {
        return new Promise((resolve, reject) => {
            data.id = Date.now()
            this.send(this.socket.post, this.socketInfo.post.waitFunc, data, resolve)
        })
    }
    postAndCheckResponse(data) {
        return new Promise((resolve, reject) => {
            this.post(data).then((r)=>{
                if (r.err) {
                    reject(r.err)
                } else {
                    resolve(r)
                }
            })
        })
    }
    async postParseThrift(data) {
        let reqJson, resJson;
        reqJson = data
        resJson = JSON.parse(await this.postAndCheckResponse(reqJson))
        return resJson
    }
    async postRequestAndGetResponse(data, methodName) {
        let request = { value: data, name: methodName, type: 1 }
        let response = await this.postParseThrift(request)
        return response.value
    }
    async postRequestAndGetContinueResponse(data, methodName) {
        let responseList = []
        let addKeys = []
        let noAddKeys = []
        let request = { value: data, name: methodName, type: 1 }
        let response = await this.postParseThrift(request)
        responseList.push(response.value)
        while (response.value.continuationToken) {
            request.value.continuationToken = response.value.continuationToken
            request.value.syncToken = response.value.syncToken
            response = await this.postParseThrift(request)
            responseList.push(response.value)
        }
        Object.keys(responseList[0]).forEach((e) => {
            if ((typeof responseList[0][e]) == "object") {
                addKeys.push(e)
            } else {
                noAddKeys.push(e)
            }
        })
        let returnjson = {}
        responseList.forEach((e) => {
            noAddKeys.forEach((f) => {
                returnjson[f] = e[f]
            })
            addKeys.forEach((g) => {
                if (e[g].forEach) {
                    if (returnjson[g]) {
                        returnjson[g] = [...returnjson[g], ...e[g]]
                    } else {
                        returnjson[g] = e[g]
                    }
                } else {
                    if (returnjson[g]) {
                        returnjson[g] = { ...returnjson[g], ...e[g] }
                    } else {
                        returnjson[g] = e[g]
                    }
                }
            })
        })
        return returnjson
    }
    send(socket, FuncMap, data, returnFunc) {
        if (socket.readyState === socket.OPEN) {
            socket.send(JSON.stringify(data))
            FuncMap[data.id] = (e) => {
                returnFunc(e.data)
            }
            socket.onmessage = (e) => {
                try {
                    let j = JSON.parse(e.data)
                    FuncMap[j.id](e)
                    delete FuncMap[j.id]
                } catch (error) {
                }
            }
        } else { throw new Error("socket not open") }
    }
}

class LineSquareClient {
    constructor(authToken, device) {
        this.SQ1 = new LineTCompactSocket("/SQ1", authToken, device)
    }
    async findSquareByInvitationTicket(ticket) {
        let v = { invitationTicket: ticket }
        let n = "findSquareByInvitationTicket"
        return await this.SQ1.postRequestAndGetResponse(v, n)
    }
    async getJoinedSquares() {
        let v = { limit: 100 }
        let n = "getJoinedSquares"
        return await this.SQ1.postRequestAndGetContinueResponse(v, n)
    }
    async searchSquareMembers(squareMid, searchOption = {}) {
        let v = {
            squareMid: squareMid,
            searchOption: searchOption,
            limit: 200
        }
        let n = "searchSquareMembers"
        return await this.SQ1.postRequestAndGetContinueResponse(v, n)
    }
    async getBannedMembers(squareMid, searchOption = { "membershipState": 6 }) {
        return await this.searchSquareMembers(squareMid, searchOption)
    }
    async sendTxtMessage(squareChatMid, text, contentMetadata = {}, reqSeq = 1) {
        let v = {
            reqSeq: reqSeq,
            squareChatMid: squareChatMid,
            squareMessage: {
                    message:{
                      to: squareChatMid,
                      contentType: 0,
                      text:text,
                      contentMetadata: contentMetadata
                  }},
            }
        let n = "sendMessage"
        return await this.SQ1.postRequestAndGetResponse(v, n)
    }
    async fetchMyEvents(syncToken = 1) {
        let v = {
            syncToken: syncToken,
            limit: 200
        }
        let n = "fetchMyEvents"
        return await this.SQ1.postRequestAndGetContinueResponse(v, n)
    }
    async fetchSquareChatEvents(squareChatMid, syncToken) {
        let v = {
            squareChatMid: squareChatMid,
            limit: 200
        }
        if (syncToken) {
            v.syncToken = syncToken
        }
        let n = "fetchSquareChatEvents"
        return await Account.postRequestAndGetResponse(v, n)
    }

}