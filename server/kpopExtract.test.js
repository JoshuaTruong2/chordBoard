import { extractFromKpopHtml } from "./kpopExtract.js";

const sample = `
<html><body>
<article>
<h1 class="entry-title">Test Artist &#8211; Test Song (Chords + Romanized Lyrics)</h1>
<div class="entry-content">
<pre>Artist: Test Artist
Title: Test Song
Capo: 2</pre>
<div class="cpress_line"><span class="cpress_comment">Intro</span></div>
<div class="cpress_line">
  <div class="cpress_line_section">
    <div class="chord key-x-0"><span class="chordshort">Am7</span>&nbsp;</div>
    <div class="chord key-x-1" style="display:none"><span class="chordshort">A#m7</span>&nbsp;</div>
    <div class="lyric"></div>
  </div>
  <div class="cpress_line_section">
    <div class="chord key-x-0"><span class="chordshort">G</span>&nbsp;</div>
    <div class="lyric">hello</div>
  </div>
</div>
<div class="cpress_line">
  <div class="cpress_line_section">
    <div class="chord key-x-0"><span class="chordshort">C</span>&nbsp;</div>
    <div class="lyric">world</div>
  </div>
</div>
</div>
Related posts
</article>
<footer>slot gacor spam should not appear</footer>
</body></html>
`;

const result = extractFromKpopHtml(sample);
if (!result.text.includes("Test Artist – Test Song")) throw new Error("missing title");
if (!result.text.includes("[Intro]")) throw new Error("missing intro");
if (!result.text.includes("[Am7][G]hello")) throw new Error(`bad intro line: ${result.text}`);
if (!result.text.includes("[C]world")) throw new Error("missing verse line");
if (result.text.includes("A#m7")) throw new Error("picked hidden transpose variant");
if (result.text.includes("slot gacor")) throw new Error("included footer spam");
console.log("kpopExtract.test.js OK");
