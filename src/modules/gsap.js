import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger.js';
import { Draggable } from 'gsap/Draggable.js';


// https://codepen.io/GreenSock/pen/RwKwLWK

gsap.registerPlugin(ScrollTrigger, Draggable);
let iteration = 0; // gets iterated when we scroll all the way to the end or start and wraps around - allows us to smoothly continue the playhead scrubbing in the correct direction.

// set initial state of items
gsap.set('.cards li', { yPercent: 0, opacity: 0, scale: 1 });

const spacing = 0.2; // spacing of the cards (stagger)
const snapTime = gsap.utils.snap(spacing); // we'll use this to snapTime the playhead on the seamlessLoop
const cards = gsap.utils.toArray('.cards li');
// this function will get called for each element in the buildSeamlessLoop() function, and we just need to return an animation that'll get inserted into a master timeline, spaced
const animateFunc = (element) => {
  const tl = gsap.timeline();
  tl.fromTo(
    element,
    { scale: 1, opacity: 0.5 },
    {
      scale: 2,
      opacity: 1,
      zIndex: 100,
      duration: 0.5,
      yoyo: true,
      repeat: 1,
      ease: 'power3.in',
      immediateRender: false,
    },
  ).fromTo(
    element,
    { yPercent: 0 },
    { yPercent: 400, duration: 1, ease: 'none', immediateRender: false },
    0,
  );
  return tl;
};
const seamlessLoop = buildSeamlessLoop(cards, spacing, animateFunc);
const playhead = { offset: 0 }; // a proxy object we use to simulate the playhead position, but it can go infinitely in either direction and we'll just use an onUpdate to convert it to the corresponding time on the seamlessLoop timeline.
const wrapTime = gsap.utils.wrap(0, seamlessLoop.duration()); // feed in any offset (time) and it'll return the corresponding wrapped time (a safe value between 0 and the seamlessLoop's duration)
const scrub = gsap.to(playhead, {
  // we reuse this tween to smoothly scrub the playhead on the seamlessLoop
  offset: 0,
  onUpdate() {
    seamlessLoop.time(wrapTime(playhead.offset)); // convert the offset to a "safe" corresponding time on the seamlessLoop timeline
  },
  duration: 0.5,
  ease: 'power3',
  paused: true,
});
const trigger = ScrollTrigger.create({
  start: 0,
  onUpdate(self) {
    const scroll = self.scroll();
    if (scroll > self.end - 1) {
      wrap(1, 2);
    } else if (scroll < 1 && self.direction < 0) {
      wrap(-1, self.end - 2);
    } else {
      scrub.vars.offset = (iteration + self.progress) * seamlessLoop.duration();
      scrub.invalidate().restart(); // to improve performance, we just invalidate and restart the same tween. No need for overwrites or creating a new tween on each update.
    }
  },
  end: '+=3000',
  pin: '.gallery',
});
// converts a progress value (0-1, but could go outside those bounds when wrapping) into a "safe" scroll value that's at least 1 away from the start or end because we reserve those for sensing when the user scrolls ALL the way up or down, to wrap.
const progressToScroll = (progress) =>
  gsap.utils.clamp(1, trigger.end - 1, gsap.utils.wrap(0, 1, progress) * trigger.end);
const wrap = (iterationDelta, scrollTo) => {
  iteration += iterationDelta;
  trigger.scroll(scrollTo);
  trigger.update(); // by default, when we trigger.scroll(), it waits 1 tick to update().
};

// when the user stops scrolling, snap to the closest item.
ScrollTrigger.addEventListener('scrollEnd', () => scrollToOffset(scrub.vars.offset));

// feed in an offset (like a time on the seamlessLoop timeline, but it can exceed 0 and duration() in either direction; it'll wrap) and it'll set the scroll position accordingly. That'll call the onUpdate() on the trigger if there's a change.
function scrollToOffset(offset) {
  // moves the scroll playhead to the place that corresponds to the totalTime value of the seamlessLoop, and wraps if necessary.
  const snappedTime = snapTime(offset);
  const progress = (snappedTime - seamlessLoop.duration() * iteration) / seamlessLoop.duration();
  const scroll = progressToScroll(progress);
  if (progress >= 1 || progress < 0) {
    return wrap(Math.floor(progress), scroll);
  }
  trigger.scroll(scroll);
}

function buildSeamlessLoop(items, spacing, animateFunc) {
  const rawSequence = gsap.timeline({ paused: true }); // this is where all the "real" animations live
  const seamlessLoop = gsap.timeline({
    // this merely scrubs the playhead of the rawSequence so that it appears to seamlessly loop
    paused: true,
    repeat: -1, // to accommodate infinite scrolling/looping
    onRepeat() {
      // works around a super rare edge case bug that's fixed GSAP 3.6.1
      this._time === this._dur && (this._tTime += this._dur - 0.01);
    },
    onReverseComplete() {
      this.totalTime(this.rawTime() + this.duration() * 100); // seamless looping backwards
    },
  });
  const cycleDuration = spacing * items.length;
  let dur; // the duration of just one animateFunc() (we'll populate it in the .forEach() below...

  // loop through 3 times so we can have an extra cycle at the start and end - we'll scrub the playhead only on the 2nd cycle
  items
    .concat(items)
    .concat(items)
    .forEach((item, i) => {
      const anim = animateFunc(items[i % items.length]);
      rawSequence.add(anim, i * spacing);
      dur || (dur = anim.duration());
    });

  // animate the playhead linearly from the start of the 2nd cycle to its end (so we'll have one "extra" cycle at the beginning and end)
  seamlessLoop.fromTo(
    rawSequence,
    {
      time: cycleDuration + dur / 2,
    },
    {
      time: '+=' + cycleDuration,
      duration: cycleDuration,
      ease: 'none',
    },
  );
  return seamlessLoop;
}
