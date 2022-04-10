export default class Remote {
    constructor() {
        this.remoteData = {};

        this.oldData = {};

        this.predictions = {};

        this.loadingPlayer = false;

        this.lastUpdate = 0;

        this.players = {};

        this.ping = 0;
    }
}
