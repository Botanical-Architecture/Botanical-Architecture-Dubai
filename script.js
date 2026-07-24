
/* SLIDER DATA */
const data = {
    1: ["AED 2,000", "A hands-on botanical workshop, tailored to your group."],
    2: ["AED 5,000", "A styled botanical activation for your event or brand moment."],
    3: ["AED 10,000", "Your first living installation, designed for your space."],
    4: ["AED 15,000", "A living scheme designed for your shop."],
    5: ["AED 20,000", "A fuller shop scheme, in first bloom."],
    6: ["AED 25,000", "Semi-permanent architectural planting, scoped per brief."],
    7: ["AED 35,000", "One statement installation, with a maintenance retainer."],
    8: ["AED 50,000+", "A complete installation for retail, F&B or hospitality."]
};

const slider = document.getElementById("slider");
const title = document.getElementById("title");
const desc = document.getElementById("desc");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const bloomColors = ["#c69a34", "#ab5334", "#d98f72"];
const leafColors = ["#3c4a2d", "#4d5c3a", "#6d7a4c"];

const anchorColor = "#262f1a";
const bloomCenter = "#f6f1e3";

/* Abstract "geometric faceted bloom" scene per tier. Each tier is a single
   low-poly composition: angular triangular leaf facets fanning up from a
   faceted base, topped with polygonal (hex/heptagon/...) blooms. Every value
   below rises monotonically with the tier so more budget always reads as a
   taller, wider, denser mark: more facets, wider fan (spread), more + larger
   + more-sided polygon blooms, and a taller fill fraction of the canvas. */
const facetConfig = {
    1: { facets: 3,  blooms: 0, bloomSides: 6, spread: 62,  fill: 0.40 },
    2: { facets: 5,  blooms: 1, bloomSides: 6, spread: 80,  fill: 0.47 },
    3: { facets: 7,  blooms: 1, bloomSides: 6, spread: 96,  fill: 0.54 },
    4: { facets: 9,  blooms: 2, bloomSides: 7, spread: 112, fill: 0.61 },
    5: { facets: 12, blooms: 2, bloomSides: 7, spread: 128, fill: 0.68 },
    6: { facets: 15, blooms: 3, bloomSides: 8, spread: 144, fill: 0.75 },
    7: { facets: 18, blooms: 4, bloomSides: 8, spread: 158, fill: 0.82 },
    8: { facets: 22, blooms: 5, bloomSides: 9, spread: 172, fill: 0.88 }
};

let cssWidth = 0;
let cssHeight = 0;

function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    cssWidth = rect.width;
    cssHeight = rect.height;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* Small deterministic PRNG (mulberry32) so each tier's facet jitter is
   stable frame-to-frame — the composition must not reshuffle on every
   redraw, and stable output keeps the tier screenshots reproducible. */
function makeRng(seed) {
    let s = seed >>> 0;
    return function () {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/* Trace a regular polygon path (straight-edged) centred at (cx, cy). */
function polygonPath(ctx, cx, cy, r, sides, rot) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
        const a = rot + (i / sides) * Math.PI * 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
}

/* One low-poly leaf facet: a kite split down its axis into two triangles of
   adjacent leaf hues, giving an angular folded/creased shard rather than an
   organic curved leaf. Returns the tip point so blooms can perch on it. */
function drawFacet(ctx, ox, oy, angle, length, halfWidth, colorL, colorR) {
    const ax = Math.sin(angle);       // axis (up-ish) direction
    const ay = -Math.cos(angle);
    const px = Math.cos(angle);       // perpendicular direction
    const py = Math.sin(angle);
    const tx = ox + ax * length;
    const ty = oy + ay * length;
    const mx = ox + ax * length * 0.45;
    const my = oy + ay * length * 0.45;
    const lx = mx - px * halfWidth, ly = my - py * halfWidth;
    const rx = mx + px * halfWidth, ry = my + py * halfWidth;

    ctx.globalAlpha = 0.85;           // overlap builds subtle depth
    ctx.beginPath();
    ctx.moveTo(ox, oy); ctx.lineTo(lx, ly); ctx.lineTo(tx, ty); ctx.closePath();
    ctx.fillStyle = colorL; ctx.fill();

    ctx.beginPath();
    ctx.moveTo(ox, oy); ctx.lineTo(rx, ry); ctx.lineTo(tx, ty); ctx.closePath();
    ctx.fillStyle = colorR; ctx.fill();

    ctx.globalAlpha = 0.4;            // crease line down the fold
    ctx.beginPath();
    ctx.moveTo(ox, oy); ctx.lineTo(tx, ty);
    ctx.strokeStyle = anchorColor; ctx.lineWidth = 1; ctx.stroke();
    ctx.globalAlpha = 1;

    return { x: tx, y: ty };
}

/* Polygonal bloom: concentric straight-edged polygons (outer petal ring,
   rotated inner ring, cream core) for a layered faceted gem look. */
function drawFacetBloom(ctx, x, y, r, sides, colorA, colorB) {
    ctx.globalAlpha = 0.92;
    polygonPath(ctx, x, y, r, sides, -Math.PI / 2);
    ctx.fillStyle = colorA; ctx.fill();

    ctx.globalAlpha = 0.96;
    polygonPath(ctx, x, y, r * 0.62, sides, -Math.PI / 2 + Math.PI / sides);
    ctx.fillStyle = colorB; ctx.fill();

    ctx.globalAlpha = 1;
    polygonPath(ctx, x, y, r * 0.3, sides, -Math.PI / 2);
    ctx.fillStyle = bloomCenter; ctx.fill();

    ctx.globalAlpha = 0.5;
    polygonPath(ctx, x, y, r, sides, -Math.PI / 2);
    ctx.strokeStyle = anchorColor; ctx.lineWidth = 1; ctx.stroke();
    ctx.globalAlpha = 1;
}

/* Assemble the abstract mark: a faceted diamond base, a fan of leaf facets
   rising from it (longer through the middle for a leaf-like silhouette), and
   polygonal blooms distributed across the outer tips. */
function drawFacetComposition(ctx, cx, baseY, config, canvasHeight, rng) {
    const available = canvasHeight - 48;
    const maxLen = available * config.fill;
    const spreadRad = (config.spread * Math.PI) / 180;

    const anchorR = Math.max(5, maxLen * 0.09);
    polygonPath(ctx, cx, baseY, anchorR, 4, 0);
    ctx.fillStyle = anchorColor; ctx.fill();

    const tips = [];
    for (let i = 0; i < config.facets; i++) {
        const t = config.facets <= 1 ? 0.5 : i / (config.facets - 1);
        const angle = -spreadRad / 2 + t * spreadRad;
        const shape = 0.55 + 0.45 * Math.sin(Math.PI * t); // taller mid-fan
        const len = maxLen * shape * (0.9 + rng() * 0.2);
        const halfWidth = len * (0.12 + rng() * 0.05);
        const colorL = leafColors[i % leafColors.length];
        const colorR = leafColors[(i + 1) % leafColors.length];
        tips.push(drawFacet(ctx, cx, baseY, angle, len, halfWidth, colorL, colorR));
    }

    for (let j = 0; j < config.blooms; j++) {
        const tipIndex = config.facets <= 1
            ? 0
            : Math.round(((j + 1) / (config.blooms + 1)) * (config.facets - 1));
        const tip = tips[tipIndex];
        if (!tip) continue;
        const bloomR = maxLen * (0.1 + j * 0.008);
        const cA = bloomColors[j % bloomColors.length];
        const cB = bloomColors[(j + 1) % bloomColors.length];
        drawFacetBloom(ctx, tip.x, tip.y, bloomR, config.bloomSides, cA, cB);
    }
}

function draw(level) {
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const config = facetConfig[level];
    const baseY = cssHeight - 40;
    const cx = cssWidth / 2;
    const rng = makeRng(1000 + Number(level) * 97);

    drawFacetComposition(ctx, cx, baseY, config, cssHeight, rng);
}

slider.oninput = function () {
    const v = data[this.value];
    title.innerText = v[0];
    desc.innerText = v[1];

    draw(this.value);
};

/* NAV: reliable smooth-scroll + scroll-spy.
   Native hash-jump was landing on stale offsets after the web fonts swapped
   in and reflowed the headings, so drive the scroll from JS instead. The
   href="#id" attributes stay in place as a no-JS/accessibility fallback. */
const navAnchors = Array.from(document.querySelectorAll('nav .wordmark, nav .links a'));

navAnchors.forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
        const targetId = anchor.getAttribute('href');
        const target = document.querySelector(targetId);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.pushState(null, '', targetId);
    });
});

/* Scroll-spy: highlight the nav link for the section currently under the nav.
   scroll-margin-top handles the fixed-nav offset for scrollIntoView natively,
   so mirror that here by clipping the top of the observer root by --nav-h. */
const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'), 10) || 0;
const anchorById = {};
navAnchors.forEach(function (anchor) {
    anchorById[anchor.getAttribute('href').slice(1)] = anchor;
});

function setActiveSection(id) {
    navAnchors.forEach(function (anchor) {
        anchor.classList.toggle('active', anchor === anchorById[id]);
    });
}

const spySections = ['top', 'about', 'work', 'contact']
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);

const navObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
        if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
        }
    });
}, { rootMargin: '-' + navH + 'px 0px -70% 0px', threshold: 0 });

spySections.forEach(function (section) { navObserver.observe(section); });

// initial render
sizeCanvas();
draw(1);

/* Decorative pinata-style botanical burst from the hero sticker.
   Reuses the site's leafColors palette so particles match the brand. */
(function () {
    const sticker = document.getElementById("growSticker");
    if (!sticker) return;

    function spawnLeafBurst() {
        const rect = sticker.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const count = 15 + Math.floor(Math.random() * 11); // 15-25

        for (let i = 0; i < count; i++) {
            const leaf = document.createElement("div");
            leaf.className = "leaf-burst";

            const ang = Math.random() * Math.PI * 2;
            const dist = 40 + Math.random() * 90;           // outward burst radius
            const mx = Math.cos(ang) * dist;
            const my = Math.sin(ang) * dist;
            const gravity = 90 + Math.random() * 140;       // downward fall
            const ex = mx * 1.35;
            const ey = my * 1.05 + gravity;

            const size = 8 + Math.random() * 8;
            const color = leafColors[Math.floor(Math.random() * leafColors.length)];
            const rm = (Math.random() * 240 - 120) + "deg";
            const re = (Math.random() * 720 - 360) + "deg";
            const dur = 1000 + Math.random() * 500;         // 1-1.5s

            leaf.style.background = color;
            leaf.style.width = size + "px";
            leaf.style.height = size + "px";
            leaf.style.setProperty("--x0", cx + "px");
            leaf.style.setProperty("--y0", cy + "px");
            leaf.style.setProperty("--xm", (cx + mx) + "px");
            leaf.style.setProperty("--ym", (cy + my) + "px");
            leaf.style.setProperty("--rm", rm);
            leaf.style.setProperty("--xe", (cx + ex) + "px");
            leaf.style.setProperty("--ye", (cy + ey) + "px");
            leaf.style.setProperty("--re", re);
            leaf.style.setProperty("--burst-dur", dur + "ms");

            let removed = false;
            const remove = function () {
                if (removed) return;
                removed = true;
                if (leaf.parentNode) leaf.parentNode.removeChild(leaf);
            };
            leaf.addEventListener("animationend", remove);
            setTimeout(remove, dur + 200); // safety net if animationend misfires

            document.body.appendChild(leaf);
        }
    }

    sticker.addEventListener("click", spawnLeafBurst);
    sticker.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
            e.preventDefault();
            spawnLeafBurst();
        }
    });
})();

/* Enquire links: stop the click from bubbling to the surrounding card. */
Array.from(document.querySelectorAll('.enquire-btn')).forEach(function (btn) {
    btn.addEventListener('click', function (e) {
        e.stopPropagation();
    });
});

