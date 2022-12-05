export let sanitizeInput = function (input) {
    return input.replaceAll(' ', '%20').replaceAll('+', '%2B')
}
