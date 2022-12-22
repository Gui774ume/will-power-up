export let sanitizeInput = function (input) {
    return input.replaceAll(' ', '%20').replaceAll('+', '%2B')
}

export function RequestPacer(delay = 2000, every = 5) {
    this.delay = delay
    this.every = every
    this.list = []
    this.weight = 0
    this.add = async function(promise, weight = 1) {
        this.list.push(promise);

        for (let i = 0; i < weight; i++) {
            this.weight++;
            if (this.weight % this.every === 0) {
                await new Promise(resolve => setTimeout(resolve, this.delay));
            }
        }
    }
    this.wait = function() {
        return Promise.all(this.list);
    }
}