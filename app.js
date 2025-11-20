const md = markdownit({
	html: false, /* escape non-code html */
	breaks: true /* \n to <br> */
}).disable('code') /* only ```fence``` and `inline`, not indented */
md.use(mdKatex)

const gsPrefix = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/' // used to come through in the text from gemini with grounding/search enabled. not sure if still an issue
const linkifyOptions = {
	format: {
		url: (value) => {
			return value.startsWith(gsPrefix) ? '🔗' : value // replace displayed text
		}
	},
	target: '_blank',
	className: {
		url: (value) => {
			if (value.startsWith(gsPrefix)) {
				return 'no-underline-link'
			}
			return null
		}
	}
}

let user = location.protocol === 'file:' ? 'llm10' /* enter github username for local dev */ : location.host.split('.')[0]
let id = location.search.substring(1)
let data, nHist
let histLoaded = false

if (id) {
	$.get('https://raw.githubusercontent.com/' + user + '/' + user + '.github.io' + '/HEAD/results/' + id[0] + '/' + (id.length > 1 ? id[1] : '0') + '/' + id)
		.done(r => {
			if (!r) return
			const bs = atob(r); // https://tinyurl.com/atob5
			const b = new Uint8Array(bs.length);
			for (let i = 0; i < bs.length; i++) b[i] = bs.charCodeAt(i);
			r = new TextDecoder().decode(b);

			try {
				data = JSON.parse(r)/*
						s:"Grok", // service name
						m:"grok-3-mini", // model
						t:123456789, // time
						r:[ // deprecated
							["u","t","text"], // user, type, text
							["a","t","text"]
						]
						r:[ // new
							{role:"u",text:"text"},
							{role:"a",text:"text",sources:[]}
						]
						*/
				console.log('data:', data)
				data.s_lc = data.s.toLowerCase()
				$('head').prepend('<link rel="icon" href="images/' + data.s_lc + '-icon-light.svg" type="image/svg+xml" media="(prefers-color-scheme: light)"/>\n<link rel="icon" href="images/' + data.s_lc + '-icon-dark.svg" type="image/svg+xml" media="(prefers-color-scheme: dark)"/>')
				document.getElementById('logo-' + data.s_lc).style = 'display:block'; // jq append was slow
				if(data.m) document.getElementById('logo-' + data.s_lc).title = data.m

				let q = data.r[data.r.length - 2].text || data.r[data.r.length - 2][2] // [2] deprecated
				let a = data.r[data.r.length - 1].text || data.r[data.r.length - 1][2]
				document.title = q

				$('#cur_h').html(linkifyHtml(md.render(q), linkifyOptions))
				$('#cur_r').html(linkifyHtml(md.render(a), linkifyOptions))
				hljs.highlightAll();
				addCopyButtons()

				if (data.r[data.r.length - 1].sources) addSources(data.r[data.r.length - 1].sources, $('#cur_r'))

				nHist = (data.r.length - 2) / 2
				if (location.hash === '#history') loadHistory(1)
				let h = ''
				// if (data.m) { // still figuring out best way to show model
				// 	let url, a
				// 	if (data.m.match(/^grok-/)) url = 'https://docs.x.ai/docs/models/' + data.m
				// 	else if (data.m.match(/^gemini-/)) url = 'https://ai.google.dev/gemini-api/docs/models#' + data.m
				// 	else if (data.m.match(/^gpt-/)) url = 'https://platform.openai.com/docs/models/' + data.m
				// 	if (url) a = '<a href="' + url + '" target="_blank">' + data.m + '</a>'; else a = data.m
				// 	h += '<div class="note">' + a + '</div>'
				// }
				if (data.r.length > 2) h += '<div class="note-wrap"><div class="note">Results may vary based on <span id="show_hist">chat history▴</span></div></div>'
				$('#main').append('<div class="note-wrap">' + h + '</div>')
				$("#show_hist").click(() => {
					if (!histLoaded) loadHistory()
					else $("body")[0].scrollIntoView({behavior: 'smooth'})
				})
			} catch (e) {
				$('body').text('Error: ' + e.message)
				console.log('r:', r)
			}
			$('#main').show()
		})
		.fail(() => {
			$('body').text('Response not found')
			$('#main').show()
		});
} else {
	$('body').text('Hmm, there\'s nothing here...')
	$('#main').show()
}

function loadHistory() {
	let old_height = $(document).height(); // https://stackoverflow.com/a/21494434
	let old_scroll = $(window).scrollTop();
	for (let i = data.r.length - 1; i >= 0; i--) {
		if (i >= data.r.length - 2) continue;
		if ((data.r[i].role || data.r[i][0]) === 'u') $('#main').prepend('<div class="h_wrap"><div class="h" id="r' + i + '"></div></div>') // [0] deprecated
		else $('#main').prepend('<div class="r" id="r' + i + '"></div>')
		let r = data.r[i].text || data.r[i][2] // [2] deprecated
		$('#r' + i).html(linkifyHtml(md.render(r), linkifyOptions))
		hljs.highlightAll();
		addCopyButtons()
		if (data.r[i].sources) addSources(data.r[i].sources, $('#r' + i))
	}

	$('#main').prepend('<div id="head_note" class="note-wrap note">Viewing chat history (' + nHist + ' item' + (nHist > 1 ? 's' : '') + '). <span id="go_main">Go to current▾</span></div>')
	$("#go_main").click(() => {
		$("#cur_h")[0].scrollIntoView({behavior: 'smooth'})
	})
	$(document).scrollTop(old_scroll + $(document).height() - old_height);
	$("body")[0].scrollIntoView({behavior: 'smooth'})
	histLoaded = true
}

function addCopyButtons() {
	// Select only <code> blocks that are children of <pre>
	$('pre code').each(function () {
		var $codeBlock = $(this);
		// The container is always the parent <pre>
		var $container = $codeBlock.parent('pre');

		// If a copy button already exists within this container, skip adding another one.
		if ($container.find('.copy-button').length > 0) {
			return true; // Continue to the next .each() iteration
		}

		// Ensure the container has relative positioning.
		// This is also handled by CSS, but added here for robustness.
		if ($container.css('position') !== 'relative' && $container.css('position') !== 'absolute' && $container.css('position') !== 'fixed') {
			$container.css('position', 'relative');
		}

		// Create the copy button element
		var $copyButton = $('<button class="copy-button">Copy</button>');

		// Append the button to the determined container
		$container.append($copyButton);

		// Click event handler for the copy button
		$copyButton.on('click', function () {
			var codeText = $codeBlock.text();

			// Use the modern Clipboard API only. No fallback.
			if (navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(codeText).then(function () {
					// Success feedback
					$copyButton.text('Copied!');
					setTimeout(function () {
						$copyButton.text('Copy'); // Revert text after a short delay
					}, 2000);
				}).catch(function (err) {
					console.error('Failed to copy text (Clipboard API error): ', err);
					$copyButton.text('Error!'); // Indicate failure
					setTimeout(function () {
						$copyButton.text('Copy');
					}, 2000);
				});
			} else {
				// If Clipboard API is not available, indicate that.
				console.warn('Clipboard API not available in this browser/context.');
				$copyButton.text('No API!'); // Or "Not Supported"
				setTimeout(function () {
					$copyButton.text('Copy');
				}, 2000);
			}
		});
	});
}

function addSources(c, jqEl) {
	if (!c || !c.length) return
	// let h = ''
	let h = '<span class="sources-btn">Sources</span><span class="sources">'
	for (let i = 0; i < c.length; i++) {
		let u = new URL(c[i])
		let t = u.hostname.replace(/^www\./, '')
		// let f = 'https://icons.duckduckgo.com/ip3/' + u.hostname + '.ico'
		let f = 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=' + u.origin + '&size=32' // or e.g. http://www.google.com/s2/favicons?domain=x.com
		h += '<a title="' + t + '" href="' + c[i] + '" target="_blank" style="margin-right:5px;"><img alt="" style="height:18px;width:18px;vertical-align:middle;" src="' + f + '" "/></a>'
	}
	h += '</span>'
	jqEl.append('<p>' + h + '</p>')
	jqEl.find('p').last().find('a').on('click', function () { // tooltip display fix https://stackoverflow.com/q/44064699
		let $this = $(this);
		$this.hide();
		setTimeout(function () {
			$this.show()
		}, 1)
	})
	jqEl.find('.sources-btn').hover(function () {
		$(this).addClass('hidden');
		$('body').addClass('hide-tooltips'); // prevent tips during animation
		$(this).next().addClass('show');
		setTimeout(function () {
			$('body').removeClass('hide-tooltips');
		}, 300)
	})
	jqEl.tooltip({show: false, hide: false})
}

// markdown-it KaTeX plugin
const ALL_DELIMITERS = [
	{left: '\\[', right: '\\]', display: true},
	{left: '$$', right: '$$', display: true},
	{left: '\\(', right: '\\)', display: false},
	{left: '$', right: '$', display: false},
];

function mdKatex(md) {
	// handle all as inline - css will format blocks anyway and avoids some issues
	md.inline.ruler.after('text', 'mdKatex', mdKatexRule());
}

function mdKatexRule() {
	return (state, silent) => {
		const start = state.pos;
		let delimiter = null;
		for (const d of ALL_DELIMITERS) {
			if (state.src.slice(start).startsWith(d.left)) {
				delimiter = d;
				break;
			}
		}
		if (!delimiter) return false;

		const {left, right, display} = delimiter;
		const rightLen = right.length;
		const contentStart = start + left.length;
		let endPos = contentStart;

		while (endPos < state.posMax && !state.src.slice(endPos).startsWith(right)) endPos += (state.src.charCodeAt(endPos) === 0x5C ? 2 : 1);
		if (endPos >= state.posMax) return false;

		const mathContent = state.src.slice(contentStart, endPos).trim();

		if (left === '$' // $ error avoidance
			&& (/\w/.test(state.src.charAt(start - 1)) || /\w/.test(state.src.charAt(endPos + rightLen)) || mathContent.length === 0)
			&& !mathContent.match(/^\[?\\[a-z]+]?$/) // allow any single word $\command$
		) return false;

		if (silent) {
			state.pos = endPos + rightLen;
			return true;
		}

		let renderedHTML;
		try {
			renderedHTML = katex.renderToString(mathContent, {throwOnError: false, output: 'html', displayMode: display});
		} catch (err) {
			renderedHTML = `[KaTeX ERROR: ${err.message}]`;
		}

		const token = state.push('html_inline', '', 0);
		token.content = renderedHTML;
		state.pos = endPos + rightLen;

		return true;
	};
}