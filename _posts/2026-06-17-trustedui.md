---
title: Chrome trusted UI spoof (Awarded $2000)
---

`chrome://image` fetches an image from the web. Since it is a chrome:-scheme page, Chrome displays this as a trusted chrome page in the omnibox UI (e.g., visiting `chrome://image/?https://http.cat/200`)  
Allowing any extension to spoof UI by using `chrome.tabs.create({url: "chrome://image/?https://http.cat/200"});`  
This was fixed by <https://issuetracker.google.com/40059921>
