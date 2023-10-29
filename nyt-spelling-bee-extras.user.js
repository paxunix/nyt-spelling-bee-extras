// ==UserScript==
// @name        Spelling Bee Extras
// @namespace   paxunix@gmail.com
// @match       https://www.nytimes.com/puzzles/spelling-bee/*
// @match       https://www.nytimes.com/puzzles/spelling-bee
// @downloadURL https://raw.githubusercontent.com/paxunix/nyt-spelling-bee-extras/main/nyt-spelling-bee-extras.user.js
// @updateURL   https://raw.githubusercontent.com/paxunix/nyt-spelling-bee-extras/main/nyt-spelling-bee-extras.user.js
// @require     https://cdn.jsdelivr.net/gh/paxunix/WaitForElements@v20231029/WaitForElements.min.js
// @grant       GM.addStyle
// @version     12
// ==/UserScript==


/* jshint esversion: 11 */
/* globals GM */

(async () => {

"use strict";

/* jshint esversion: 11, browser: true */


function getNowISODateParts()
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
            Object.assign({}, dtfopts, { timeZone: "America/Los_Angeles" }))    // New puzzle lands at 3am ET, so 12am PT, so use LA for time
            .formatToParts(new Date())
            .map(el => [el.type, el.value])
        );

    return {
        year: dateParts.year,
        month: dateParts.month,
        day: dateParts.day
    };
}


function getDateParts(isoDateStr)
{
    let [year, month, day] = isoDateStr.split("-");
    return {year, month, day};
}


function getDateWithDelimiter(dateParts, delim)
{
    return [ dateParts.year, dateParts.month.padStart(2, "0"), dateParts.day.padStart(2, "0")].join(delim);
}


function getSlashDate(dateParts)
{
    return getDateWithDelimiter(dateParts, "/");
}


async function fetchForumInfo(isoPuzzleDateStr)
{
    let dateParts = null;

    if ((isoPuzzleDateStr ?? "") === "")
    {
        dateParts = getNowISODateParts();
    }
    else
    {
        dateParts = getDateParts(isoPuzzleDateStr);
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


// =============== Main ===============

let isoPuzzleDateStr = ((window.location.pathname.match("(\\d+-\\d+-\\d+)")) ?? [])[1] ?? "";

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

let forumInfo = await fetchForumInfo(isoPuzzleDateStr);

update(forumInfo);

let waiter = new WaitForElements({
    selectors: [ ".sb-wordlist-window .sb-anagram" ],
    allowMultipleMatches: true,
});

waiter.match(() => update(forumInfo));

})();
