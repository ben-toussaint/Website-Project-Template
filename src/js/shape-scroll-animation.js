/**
 * Shape scroll "hand-off" animation
 * ------------------------------------------------------------
 * Nothing here changes the shapes' original position/size classes -
 * it only ever adds/removes a handful of inline styles to pin a shape
 * to the top of the viewport, then clears them again to release it
 * back into normal document flow.
 *
 * Behaviour implemented (this is the order the shapes meet the top of
 * the viewport as the page scrolls, purely because of their stacked
 * top-% offsets - no artificial speed differences needed):
 *
 *  1. Yellow, Pink and Blue scroll up normally. The instant each one's
 *     top edge touches the top of the viewport, it PINS there and waits.
 *  2. Small-green keeps scrolling underneath. The instant its tip
 *     touches the top, IT pins too - and that exact moment is what
 *     releases Yellow, which un-pins and keeps moving up (and off
 *     screen, since the page has already scrolled past its natural spot).
 *  3. Big-green never pins - it just keeps scrolling normally the whole
 *     time. Once its tip gets within BLUE_RELEASE_GAP px of the top,
 *     Blue (still pinned since step 1) is released and resumes moving.
 *  4. Red also just scrolls normally until its own tip touches the top,
 *     at which point Red pins - and that pin is what releases Small-green.
 *  5. Red only holds for RED_SELF_RELEASE_PX of extra scroll before
 *     releasing itself and continuing on normally.
 *  6. Pink pins the same way as the others in step 1, and (like Red)
 *     only holds for PINK_SELF_RELEASE_PX of extra scroll before
 *     releasing itself and continuing on normally.
 *
 * All of the above is now fully SCROLL-REVERSIBLE: every pin/release
 * decision is recomputed from the current scroll position on every
 * frame (instead of being a one-shot, one-way latch). That means
 * scrolling back up retraces exactly the same path in reverse - a
 * shape that pinned on the way down will re-pin on the way back up if
 * you cross its trigger point again, and nothing is ever left
 * permanently stuck.
 *
 * HOW TO WIRE THIS INTO YOUR MARKUP
 * ------------------------------------------------------------
 *  - Add `data-shapes-container` to the wrapping <div> that already has
 *    class="relative w-full max-w-[1514px] mx-auto aspect-[...]" in
 *    hero.html.
 *  - Add `data-shape="..."` to each <img> in hero.html, using exactly
 *    these values: blue, small-green, big-green, red, yellow, pink
 *  - Include this file with a normal <script src="..."></script>.
 *
 * IMPORTANT - if your hero section is injected at runtime (e.g. via
 * fetch().then(html => el.innerHTML = html), the shapes don't exist in
 * the DOM yet when the page's "load" event fires. This file will try
 * an automatic init on "load" as a convenience (works fine for a plain
 * static page), but if that fails to find the container it will stay
 * idle and wait for you to call:
 *
 *     window.initShapeScrollAnimation()
 *
 * ...manually, right after your hero HTML has actually been inserted
 * into the page. See the integration note at the bottom of this file.
 */
(function () {
  "use strict";

  // ---- tunables ---------------------------------------------------------
  var STICK_OFFSET = 0; // px from viewport top counted as "touching"
  var BLUE_RELEASE_GAP = 8; // px: how close big-green's tip must get to free blue
  var RED_SELF_RELEASE_PX = 8; // px of extra scroll red holds before freeing itself
  var PINK_SELF_RELEASE_PX = 8; // px of extra scroll pink holds before freeing itself

  var initialized = false;
  var pending = false;

  function initShapeScrollAnimation() {
    if (initialized || pending) return;
    pending = true;
    // Give any tooling that styles newly-inserted markup asynchronously
    // (e.g. the Tailwind browser/CDN build, which scans the DOM via a
    // MutationObserver after fetch()-injected HTML lands) a couple of
    // frames to finish applying real CSS before we measure anything with
    // getBoundingClientRect() - otherwise left/width get captured from
    // unstyled boxes and every pin ends up in the wrong place.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        pending = false;
        runInit();
      });
    });
  }

  function runInit() {
    var container = document.querySelector("[data-shapes-container]");
    if (!container) return false; // shapes not in the DOM yet - caller can retry later

    // state per shape:
    //   'normal' - in-flow, scrolling naturally
    //   'stuck'  - pinned to the top of the viewport
    // Note there is deliberately no 'done'/latched state any more - every
    // shape can move freely between 'normal' and 'stuck' in either
    // direction, which is what makes the animation reversible.
    var shapes = {};
    container.querySelectorAll("[data-shape]").forEach(function (el) {
      shapes[el.dataset.shape] = {
        el: el,
        state: "normal",
        docTop: 0, // absolute (document) top, captured once while normal
        leftPct: 0,
        widthPct: 0,
      };
    });

    var required = [
      "yellow",
      "pink",
      "blue",
      "small-green",
      "big-green",
      "red",
    ];
    var missing = required.filter(function (key) {
      return !shapes[key];
    });
    if (missing.length) {
      console.warn(
        "shape-scroll-animation: missing element(s) with data-shape=",
        missing,
      );
      return false;
    }

    // docTop/leftPct/widthPct as a % of the container never change with
    // scroll - only the shape's on-screen position does. Capture them once
    // (per shape, while it's not pinned) so we can always work out where a
    // shape *would* naturally be for any given scrollY, even while it's
    // currently pinned.
    function captureGeometry() {
      var cRect = container.getBoundingClientRect();
      var scrollY = window.scrollY;
      Object.keys(shapes).forEach(function (key) {
        var s = shapes[key];
        if (s.state !== "normal") return; // can't measure a pinned shape's natural spot
        var r = s.el.getBoundingClientRect();
        s.docTop = r.top + scrollY;
        s.leftPct = (r.left - cRect.left) / cRect.width;
        s.widthPct = r.width / cRect.width;
      });
    }

    // Where this shape's top edge would be, right now, if it were NOT
    // pinned. This is the single source of truth every pin/release
    // decision is based on, which is what makes the whole thing
    // reversible: it's just a function of the current scroll position,
    // never a one-way memory of "what already happened".
    function naturalTip(shape) {
      return shape.docTop - window.scrollY;
    }

    function pin(shape) {
      if (shape.state === "stuck") return;
      var cRect = container.getBoundingClientRect();
      shape.el.style.position = "fixed";
      shape.el.style.top = STICK_OFFSET + "px";
      shape.el.style.left = cRect.left + shape.leftPct * cRect.width + "px";
      shape.el.style.width = shape.widthPct * cRect.width + "px";
      shape.el.style.margin = "0";
      shape.state = "stuck";
    }

    function release(shape) {
      if (shape.state === "normal") return;
      shape.el.style.position = "";
      shape.el.style.top = "";
      shape.el.style.left = "";
      shape.el.style.width = "";
      shape.el.style.margin = "";
      shape.state = "normal";
    }

    function update() {
      var y = shapes.yellow,
        p = shapes.pink,
        b = shapes.blue;
      var sg = shapes["small-green"],
        bg = shapes["big-green"],
        r = shapes.red;

      // Recompute, from scratch, whether each shape *should* be stuck
      // right now. Because this is purely a function of current scroll
      // position (via naturalTip), scrolling back up automatically
      // retraces the same handoffs in reverse - nothing here "remembers"
      // which direction we came from.
      var wants = {
        // 1) Pins the instant its tip meets the top; released the
        //    instant small-green's tip meets the top.
        yellow: naturalTip(y) <= STICK_OFFSET && naturalTip(sg) > STICK_OFFSET,

        // 6) Pins the instant its tip meets the top; only holds for
        //    PINK_SELF_RELEASE_PX of extra scroll, then frees itself.
        pink:
          naturalTip(p) <= STICK_OFFSET &&
          naturalTip(p) > STICK_OFFSET - PINK_SELF_RELEASE_PX,

        // 1) Pins the instant its tip meets the top; released once
        //    big-green's tip gets within BLUE_RELEASE_GAP of the top.
        blue:
          naturalTip(b) <= STICK_OFFSET &&
          naturalTip(bg) > STICK_OFFSET + BLUE_RELEASE_GAP,

        // 2) Pins the instant its tip meets the top; released the
        //    instant red's tip meets the top.
        "small-green":
          naturalTip(sg) <= STICK_OFFSET && naturalTip(r) > STICK_OFFSET,

        // 3) Never pins.
        "big-green": false,

        // 4-5) Pins the instant its tip meets the top; only holds for
        //    RED_SELF_RELEASE_PX of extra scroll, then frees itself.
        red:
          naturalTip(r) <= STICK_OFFSET &&
          naturalTip(r) > STICK_OFFSET - RED_SELF_RELEASE_PX,
      };

      Object.keys(shapes).forEach(function (key) {
        var s = shapes[key];
        if (wants[key] && s.state !== "stuck") {
          pin(s);
        } else if (!wants[key] && s.state === "stuck") {
          release(s);
        }
      });
    }

    // rAF-throttled scroll handling.
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        update();
        ticking = false;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () {
      captureGeometry();
      Object.keys(shapes).forEach(function (key) {
        if (shapes[key].state === "stuck") pin(shapes[key]);
      });
    });

    captureGeometry();
    update();

    initialized = true;
    window.__shapeScrollDebug = shapes; // optional debug hook, safe to delete
    return true;
  }

  // Expose for manual invocation once your hero markup is actually in the DOM.
  window.initShapeScrollAnimation = initShapeScrollAnimation;

  // Convenience auto-attempt for plain static pages where the shapes are
  // already in the HTML source (nothing fetched at runtime). Harmless no-op
  // if the container isn't there yet - just call the function above once
  // your hero section is injected.
  window.addEventListener("load", function () {
    initShapeScrollAnimation();
  });
})();

/**
 * INTEGRATION NOTE for fetch()-based section loading
 * ------------------------------------------------------------
 * Your loadComponents() fetches hero.html and injects it asynchronously,
 * after the page's "load" event has already fired - so this script's
 * automatic attempt above will find nothing and just stay idle. Make
 * loadComponents return its promise, then call the exposed init function
 * once hero.html specifically has landed in the DOM:
 *
 *   const loadComponents = (id, url) => {
 *     return fetch(url)
 *       .then((response) => response.text())
 *       .then((html) => {
 *         document.getElementById(id).innerHTML = html;
 *       });
 *   };
 *
 *   window.onload = () => {
 *     loadComponents("header", "src/sections/header.html");
 *     loadComponents("hero", "src/sections/hero.html")
 *       .then(() => window.initShapeScrollAnimation());
 *     loadComponents("contact", "src/sections/contact.html");
 *     loadComponents("footer", "src/sections/footer.html");
 *   };
 */
