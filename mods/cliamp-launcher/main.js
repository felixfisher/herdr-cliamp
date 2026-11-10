import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, openOverlay, closeOverlay, shared, setShared } from "herdr";
import { snapshot } from "./lib.js";

// Top-right button: opens (or closes) the floating Cliamp player window.
export default class CliampLauncher extends View {
  init(_p, cx) {
    this.live = false;
    const poll = (cx) => cx.spawn(async (cx) => { const s = await snapshot(); const live = s !== null; if (live !== this.live) { this.live = live; cx.notify(); } });
    poll(cx); cx.timer.every(4000, poll);
  }

  render() {
    const t = theme();
    const open = shared("cliamp.win");
    const live = this.live;
    return h_flex().size_full().px(8).items_center().justify_center().bg(t.chrome).border_b(1).border_color(t.border)
      .child(h_flex().id("cliamp-btn").h(26).px(10).gap(6).items_center().rounded(6).text_size(12)
        .bg(open ? t.selected : t.chrome).text_color(open ? t.foreground : t.muted)
        .hover((s) => s.bg(t.hover))
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_click(() => {
          if (open) { closeOverlay(open); setShared("cliamp.win", null); }
          else setShared("cliamp.win", openOverlay({ mod: "cliamp-player", kind: "window", frame: "none", key: "cliamp", props: {} }));
        })
        .child("♪")
        .child("Cliamp")
        .when(live, (el) => el.child(div().size(6).rounded(3).bg(t.working))));
  }
}
