// ==UserScript==
// @name        Spelling Bee Extras
// @namespace   paxunix@gmail.com
// @match       https://www.nytimes.com/puzzles/spelling-bee/*
// @match       https://www.nytimes.com/puzzles/spelling-bee
// @downloadURL https://raw.githubusercontent.com/paxunix/nyt-spelling-bee-extras/main/nyt-spelling-bee-extras.user.js
// @updateURL   https://raw.githubusercontent.com/paxunix/nyt-spelling-bee-extras/main/nyt-spelling-bee-extras.user.js
// @grant       GM.addStyle
// @version     10
// ==/UserScript==

// @require     https://cdn.jsdelivr.net/gh/paxunix/WaitForElements@1.1.0/WaitForElements.min.js
(async () => {

"use strict";

class WaitForElements
{
    static _querySelectors(rootEl, selectors)
    {
        if (!(rootEl instanceof Element))
            return [];

        let results = [];
        for (let sel of Array.isArray(selectors) ? selectors : [ selectors ])
        {
            if (rootEl.matches(sel))
                results.push(rootEl);

            results = results.concat(... rootEl.querySelectorAll(sel));
        }

        return [... new Set(results)];
    }

    static _getMatchedParents(el, rootEl, selectors)
    {
        if (!(el instanceof Element))
            return [];

        let matchedEls = [];

        do {
            for (let sel of Array.isArray(selectors) ? selectors : [ selectors ])
            {
                if (el.matches(sel))
                    matchedEls.push(el);
            }

            if (el === rootEl)
                break;

            el = el.parentElement;
        } while (el !== null);

        // Reverse the list so it is ordered by innermost to outermost
        // matching elements.
        return matchedEls.reverse();
    }

    static match(options)
    {
        return new Promise((resolve, reject) => {
            let rootEl = options.target || document.body;

            if (!options.skipExisting)
            {
                // Check for element in case it already exists
                let matchEls = WaitForElements.
                    _querySelectors(rootEl, options.selectors);

                if (options.filter)
                {
                    matchEls = options.filter(matchEls, null);
                }

                if (matchEls.length !== 0)
                {
                    resolve([... new Set(matchEls)]);
                    return;
                }
            }

            // No existing matching elements, so observe for added/updated
            // elements.
            let timerId = null;
            let observer = null;
            observer = new MutationObserver(mutations => {
                // Handling characterData is special, because the target is
                // the text node itself.  We have to search up the parent
                // element hierarchy to the root element, matching those
                // elements against the selectors, and including any matched
                // nodes in the set that are affected by the characterData
                // change (because the text content change applies to all of
                // them, even if the observer only fires it for the affected
                // text node).
                let checkEls = [ ... new Set(mutations.map(m => [
                    m.type === "childList" ? Array.from(m.addedNodes) : [],
                    m.type === "attributes" ? m.target : [],
                    m.type === "characterData" ? WaitForElements._getMatchedParents(m.target.parentElement, options.target, options.selectors) : [],
                ]).flat(Infinity)) ];

                // Evaluate selectors against any of the added nodes to get
                // added (and nested) elements that match.
                let matchEls = [ ... new Set(checkEls.map(el =>
                    WaitForElements._querySelectors(el, options.selectors)
                ).flat(Infinity)) ];

                if (options.filter)
                {
                    matchEls = options.filter(matchEls);
                }

                if (matchEls.length !== 0)
                {
                    if (observer)
                        observer.disconnect();

                    if (timerId)
                        clearTimeout(timerId);

                    resolve([... new Set(matchEls)]);
                    return;
                }
            });

            let opts = null;
            if (options.observerOptions)
            {
                opts = Object.create(options.observerOptions);
            }
            else
            {
                opts = {
                    attributeOldValue: true,
                    attributes: true,
                    characterDataOldValue: true,
                    characterData: true,
                    childList: true,
                    subtree: true,
                };

                if (options.attributeFilter)
                    opts.attributeFilter = options.attributeFilter;
            }

            observer.observe(rootEl, opts);

            let timeout = options.timeout || 2000;
            if (timeout === -1)
                return;

            timerId = window.setTimeout(() => {
                observer.disconnect();

                reject(new Error(`Failed to find elements matching ${options.selectors} within ${timeout} milliseconds`));
            }, timeout);
        });
    }

    static matchOngoing(options, onMatchFn, onTimeoutFn = null)
    {
        let rootEl = options.target || document.body;

        if (options.verbose)
        {
            console.log("matchOngoing, waiting for selectors:", options.selectors);
        }

        if (!options.skipExisting)
        {
            // Check for element in case it already exists
            let matchEls = WaitForElements.
                _querySelectors(rootEl, options.selectors);

            if (options.filter)
            {
                matchEls = options.filter(matchEls, null);
            }

            if (matchEls.length !== 0)
            {
                let els = [... new Set(matchEls)];
                if (options.verbose)
                {
                    console.log("matchOngoing, found existing:", els);
                }

                onMatchFn(els);
            }
        }

        // Regardless of existing elements, observe for added/updated
        // elements.
        let timerId = null;
        let observer = null;
        observer = new MutationObserver(mutations => {
            // Handling characterData is special, because the target is
            // the text node itself.  We have to search up the parent
            // element hierarchy to the root element, matching those
            // elements against the selectors, and including any matched
            // nodes in the set that are affected by the characterData
            // change (because the text content change applies to all of
            // them, even if the observer only fires it for the affected
            // text node).
            let checkEls = [ ... new Set(mutations.map(m => [
                m.type === "childList" ? Array.from(m.addedNodes) : [],
                m.type === "attributes" ? m.target : [],
                m.type === "characterData" ? WaitForElements._getMatchedParents(m.target.parentElement, options.target, options.selectors) : [],
            ]).flat(Infinity)) ];

            // Evaluate selectors against any of the added nodes to get
            // added (and nested) elements that match.
            let matchEls = [ ... new Set(checkEls.map(el => {
                let newEls = [];

                WaitForElements._querySelectors(el, options.selectors).forEach(j => { if (!j.__WaitForElements_seen) { newEls.push(j); j.__WaitForElements_seen = 1; } });

                return newEls;
            }).flat(Infinity)) ];

            if (options.filter)
            {
                matchEls = options.filter(matchEls);
            }

            if (matchEls.length !== 0)
            {
                if (options.verbose)
                {
                    console.log("matchOngoing, mutations:", mutations);
                    console.log("matchOngoing, matched in mutations:", matchEls);
                }

                if (timerId)
                {
                    clearTimeout(timerId);

                    if (observer)
                        observer.disconnect();
                }

                onMatchFn([... new Set(matchEls)]);
            }
        });

        let opts = null;
        if (options.observerOptions)
        {
            opts = Object.create(options.observerOptions);
        }
        else
        {
            opts = {
                attributeOldValue: true,
                attributes: true,
                characterDataOldValue: true,
                characterData: true,
                childList: true,
                subtree: true,
            };

            if (options.attributeFilter)
                opts.attributeFilter = options.attributeFilter;
        }

        observer.observe(rootEl, opts);

        let timeout = options.timeout ?? -1;
        if (timeout === -1)
            return;

        timerId = window.setTimeout(() => {
            observer.disconnect();

            onTimeoutFn !== null && onTimeoutFn({
                message: new Error(`Failed to find elements matching ${options.selectors} within ${timeout} milliseconds`),
                options: options,
            });
        }, timeout);
    }
}

//===============


function getDateParts(isoDate)
{
    let dtfopts = {
        calendar: 'iso8601',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
    };
    let dateParts = Object.fromEntries(
        new Intl.DateTimeFormat(undefined,
            Object.assign({}, dtfopts, { timeZone: "America/New_York" }))    // NYT is based in NY (duh)
            .formatToParts(new Date(isoDate))
            .map(el => [el.type, el.value])
        );

    return dateParts;
}



function getDateWithDelimiter(dateParts, delim)
{
    return [ dateParts.year, dateParts.month.padStart(2, "0"), dateParts.day.padStart(2, "0")].join(delim);
}


function getSlashDate(dateParts)
{
    return getDateWithDelimiter(dateParts, "/");
}


async function fetchForumInfo(isoPuzzleDate)
{
    let dateParts = "";

    if (isoPuzzleDate === "")
    {
        dateParts = getDateParts(new Date());
    }
    else
    {
        dateParts = getDateParts(isoPuzzleDate);
    }

    let url = new URL(`${getSlashDate(dateParts)}/crosswords/spelling-bee-forum.html`, "https://www.nytimes.com/");

    let response = await fetch(url);
    if (!response.ok)
        throw new Error(`Failed to fetch '${url.href}': (${response.status}) ${response.statusText}`);

    response = await response.text();

    let doc = (new DOMParser()).parseFromString(response, "text/html");

    let wordStats = "";
    for (let el of doc.querySelectorAll("p.content"))
    {
        if (el.innerText.search(/words.*points.*pangrams/i) !== -1)
        {
            wordStats = el.innerText.trim();
            break;
        }
    }

    let twoLetter2Count = {};
    let el = null;
    for (el of doc.querySelectorAll("p.content"))
    {
        if (el.innerText.search(/two letter list\s*:/i) !== -1)
        {
            el = el.nextElementSibling;
            for (let i of el.innerText.matchAll(/([a-z][a-z])-(\d+)/gi))
            {
                twoLetter2Count[i[1].toUpperCase()] = i[2];
            }

            break;
        }
    }

    return {
        wordStats,
        twoLetter2Count
    };
}


function buildPrefixCountElement(words, forumInfo)
{
    let prefix2Count = {};
    for (let w of words)
    {
        let prefix = w.substr(0, 2).toUpperCase();
        prefix2Count[prefix] = (prefix2Count[prefix] ?? 0) + 1;
    }

    let $outer = document.createElement("div");
    let $wordStats = document.createElement("div");
    $wordStats.classList.add("sb-extras-wordstats");
    $wordStats.textContent = forumInfo.wordStats;
    $outer.append($wordStats);

    let $wrapper = document.createElement("table");
    $wrapper.style = "width: 100%;";
    $outer.append($wrapper);

    let $th = $wrapper.createTHead();
    let $thr = $th.insertRow();
    let $el = $thr.insertCell();
    $el.innerText = "Pair";
    $el = $thr.insertCell();
    $el.innerText = "# Need";
    $el = $thr.insertCell();
    $el.innerText = "# Got";

    let $tb = $wrapper.createTBody();
    let needPairs = Object.keys(forumInfo.twoLetter2Count);
    needPairs.sort();

    for (let p of needPairs)
    {
        let $tr = $tb.insertRow();
        $el = $tr.insertCell();
        $el.innerText = p;
        $el = $tr.insertCell();
        let needCount = forumInfo.twoLetter2Count[p];
        $el.innerText = needCount;
        $el = $tr.insertCell();
        let gotCount = prefix2Count[p] ?? 0;
        $el.innerText = gotCount;

        if (needCount == gotCount)
            $tr.classList.add("sb-extras-done");
    }

    return $outer;
}


function getFoundWords()
{
    let words = [];
    for (let $li of document.querySelectorAll(".sb-wordlist-window li"))
    {
        words.push($li.innerText.trim());
    }

    return words;
}


function displayCounts($el)
{
    $el.id = "sb-extras";

    let $curdiv = document.querySelector("#sb-extras");
    if ($curdiv === null)
        document.body.insertAdjacentElement("beforeend", $el);
    else
        $curdiv.replaceWith($el);
}


function update(forumInfo)
{
    let words = getFoundWords();
    let $el = buildPrefixCountElement(words, forumInfo);
    displayCounts($el);
}

let isoPuzzleDate = ((window.location.pathname.match("(\\d+-\\d+-\\d+)")) ?? [])[1] ?? "";

GM.addStyle(`
#sb-extras {
    position: absolute;
    left: 8vw;
    top: 50vh;
    font-family: monospace;
    font-size: 3.5ex;
    max-width: 16em;
    min-width: 16em;
    text-align: center;
}

#sb-extras thead {
    font-weight: bold;
}

#sb-extras tr {
    border-bottom-style: dashed;
    border-bottom-width: thin;
    border-bottom-color: lightgrey;
    padding-top: 0.3ex;
    padding-bottom: 0.3ex;
}

.sb-extras-done {
    background-color: #dcffdc;
}

.sb-extras-wordstats {
    padding-bottom:  1ex;
}
`);

let forumInfo = await fetchForumInfo(isoPuzzleDate);

update(forumInfo);

WaitForElements.matchOngoing({
    selectors: [ ".sb-wordlist-window .sb-anagram" ],
    verbose: true,
}, () => update(forumInfo));

/*
let io = new IntersectionObserver((entries) => { console.log("entries:", entries); }, {
    threshold: [0,1]
});
io.observe(document.querySelector("div.sb-wordlist-window"));
*/

})();
