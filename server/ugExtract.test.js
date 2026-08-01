import { extractFromUgHtml } from "./ugExtract.js";

const sample = `
<html><body>
<div class="js-store" data-content="{&quot;store&quot;:{&quot;page&quot;:{&quot;data&quot;:{&quot;tab&quot;:{&quot;song_name&quot;:&quot;Test Song&quot;,&quot;artist_name&quot;:&quot;Test Artist&quot;,&quot;type&quot;:&quot;Chords&quot;,&quot;tab_url&quot;:&quot;https://tabs.ultimate-guitar.com/tab/test&quot;},&quot;tab_view&quot;:{&quot;wiki_tab&quot;:{&quot;content&quot;:&quot;[tab][ch]G[/ch]    [ch]C[/ch]\\nHello world[/tab]&quot;}}}}}}"></div>
</body></html>
`;

const result = extractFromUgHtml(sample);
if (!result.text.includes("Test Song - Test Artist")) throw new Error("missing title");
if (!result.text.includes("G    C")) throw new Error("missing chords");
if (!result.text.includes("Hello world")) throw new Error("missing lyrics");
if (result.text.includes("[ch]") || result.text.includes("[tab]")) throw new Error("markup not stripped");
console.log("ugExtract.test.js OK");
