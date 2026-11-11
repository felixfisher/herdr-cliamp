import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, theme, props, run, closeOverlay, setShared, shared, notify } from "herdr";
import { PROVIDERS, VIS_FALLBACK, cliampTerminal, snapshot, ctl, launch, visModes } from "./lib.js";

const stop = (_e, cx) => cx.stop_propagation();
const REPEAT = { Off: ["off", "顺序播放"], All: ["all", "列表循环"], One: ["one", "单曲循环"] };
const NEXT_REPEAT = { Off: "all", All: "one", One: "off" };

export default class CliampPlayer extends View {
  init(_props, cx) {
    this.snap = null; this.busy = false; this.more = false; this.vol = 0;
    this.fx = false; this.modes = VIS_FALLBACK;
    cx.spawn(async (cx) => { this.modes = await visModes(); cx.notify(); });
    this.min = false;
    this.poll(cx);
    cx.timer.every(2000, (cx) => this.poll(cx));
  }

  poll(cx) {
    cx.spawn(async (cx) => {
      this.snap = await snapshot();
      cx.notify();
    });
  }

  // Run a cliamp command, then refresh the snapshot.
  act(cx, ...args) {
    cx.spawn(async (cx) => {
      await ctl(...args);
      this.snap = await snapshot(); cx.notify();
      await exec("/bin/sleep", ["1.2"]); // cliamp reports the new state a moment later
      this.snap = await snapshot(); cx.notify();
    });
  }

  start(cx, provider) {
    if (this.busy) return;
    this.busy = true; cx.notify();
    cx.spawn(async (cx) => {
      try {
        const old = cliampTerminal();
        if (old) run("terminal.kill", { terminal: old.address });
        const out = await launch(provider);
        if (out.includes('"error"')) notify({ title: "Cliamp 启动失败", body: out.slice(0, 160), level: "error" });
        else { setShared("cliamp.provider", provider); this.startedAt = Date.now(); }
      } catch (e) { notify({ title: "Cliamp 启动失败", body: String(e.message ?? e), level: "error" }); }
      this.busy = false; this.snap = null; cx.notify();
    });
  }

  setMin(v, cx) { this.min = v; cx.notify(); }

  closeWin() { setShared("cliamp.win", null); closeOverlay(props().overlay); }

  async close() { if (shared("cliamp.win") === props().overlay) setShared("cliamp.win", null); }

  chip(id, label, on, action) {
    const t = theme();
    return div().id(id).h(28).px(10).flex().items_center().justify_center().rounded(6).text_size(12)
      .bg(on ? t.selected : t.raised).text_color(on ? t.foreground : t.muted)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", stop).on_click(action).child(label);
  }

  iconBtn(id, label, action, big = false) {
    const t = theme();
    return div().id(id).size(big ? 38 : 30).flex_none().flex().items_center().justify_center().rounded(big ? 19 : 6)
      .text_size(big ? 17 : 14).bg(big ? t.solid : t.raised).text_color(big ? t.solid_foreground : t.foreground)
      .hover((s) => s.bg(big ? t.accent : t.hover)).on_mouse_down("left", stop).on_click(action).child(label);
  }

  titleBar(cx, status) {
    const t = theme();
    return h_flex().w_full().h(30).px(10).gap(8).items_center().justify_between().text_size(12).text_color(t.muted)
      .child(h_flex().gap(6).items_center().child("♪").child(div().font_semibold().text_color(t.foreground).child("Cliamp")).child(status ?? ""))
      .child(h_flex().gap(2)
        .child(div().id("cl-min").size(22).flex().items_center().justify_center().rounded(5).hover((s) => s.bg(t.hover)).on_mouse_down("left", stop).on_click((_e, cx) => this.setMin(!this.min, cx)).child(this.min ? "▢" : "—"))
        .child(div().id("cl-x").size(22).flex().items_center().justify_center().rounded(5).hover((s) => s.bg(t.hover)).on_mouse_down("left", stop).on_click(() => this.closeWin()).child("×")));
  }

  render(cx) {
    const t = theme();
    const s = this.snap;
    const term = cliampTerminal();
    const title = s?.track?.title ?? "";
    const playing = s?.state === "playing";

    if (this.min) {
      return h_flex().h(34).px(10).gap(8).items_center().bg(t.surface).border_1().border_color(t.border).rounded(17).text_size(12)
        .text_color(t.foreground)
        .child(div().id("cl-pill").flex().gap(6).items_center().on_mouse_down("left", stop).on_click((_e, cx) => this.setMin(false, cx))
          .child(playing ? "♪" : "♫").child(div().max_w(180).truncate().child(title || "Cliamp")))
        .when(s, (el) => el.child(div().id("cl-pp").size(24).flex().items_center().justify_center().rounded(12).hover((x) => x.bg(t.hover))
          .on_mouse_down("left", stop).on_click((_e, cx) => this.act(cx, "toggle")).child(playing ? "⏸" : "▶")));
    }

    const body = v_flex().w_full().px(12).pb(12).gap(10);
    const starting = !s && this.startedAt && Date.now() - this.startedAt < 20000;
    if (!s) {
      const last = shared("cliamp.provider");
      const list = this.more ? PROVIDERS : PROVIDERS.filter((p) => p.hot);
      body.child(div().text_size(12).text_color(t.muted).child(this.busy || starting ? "正在启动…" : "选择音乐来源,在当前空间新开标签页播放"));
      body.child(v_flex().gap(6).children(list.map((p) =>
        h_flex().id(`pv-${p.id}`).h(34).px(12).gap(8).items_center().rounded(8).text_size(13)
          .bg(p.id === last ? t.selected : t.raised).text_color(t.foreground).hover((x) => x.bg(t.hover))
          .on_mouse_down("left", stop).on_click((_e, cx) => this.start(cx, p.id))
          .child(div().flex_1().child(p.name)).child(div().text_size(11).text_color(t.dim).child(p.id === last ? "上次" : "")))));
      body.child(div().id("pv-more").text_size(12).text_color(t.dim).hover((x) => x.text_color(t.foreground))
        .on_mouse_down("left", stop).on_click((_e, cx) => { this.more = !this.more; cx.notify(); }).child(this.more ? "收起" : "更多来源…"));
    } else {
      const rep = REPEAT[s?.repeat] ?? REPEAT.Off;
      body.child(v_flex().gap(2)
        .child(div().text_size(14).font_semibold().text_color(t.foreground).max_w(260).truncate().child(title || (s ? "未播放" : "连接中…")))
        .child(div().text_size(11).text_color(t.dim).child(`${playing ? "播放中" : s?.state === "paused" ? "已暂停" : "已停止"} · ${s?.total ?? 0} 首`)));
      body.child(h_flex().gap(10).items_center().justify_center()
        .child(this.iconBtn("cl-prev", "⏮", (_e, cx) => this.act(cx, "prev")))
        .child(this.iconBtn("cl-toggle", playing ? "⏸" : "▶", (_e, cx) => this.act(cx, "toggle"), true))
        .child(this.iconBtn("cl-next", "⏭", (_e, cx) => this.act(cx, "next"))));
      body.child(h_flex().gap(6)
        .child(this.chip("cl-shuf", s?.shuffle ? "随机 开" : "随机 关", Boolean(s?.shuffle), (_e, cx) => this.act(cx, "shuffle", s?.shuffle ? "off" : "on")))
        .child(this.chip("cl-rep", rep[1], s?.repeat && s.repeat !== "Off", (_e, cx) => this.act(cx, "repeat", NEXT_REPEAT[s?.repeat] ?? "all"))));
      body.child(h_flex().gap(6)
        .child(this.chip("cl-vd", "音量 −", false, (_e, cx) => this.volume(cx, -3)))
        .child(this.chip("cl-vu", "音量 +", false, (_e, cx) => this.volume(cx, 3))));
      const vis = s?.visualizer ?? "";
      body.child(h_flex().gap(6)
        .child(this.chip("cl-fx", `效果:${vis === "None" ? "关" : vis}`, false, (_e, cx) => this.act(cx, "vis", "next")))
        .child(this.chip("cl-fxall", this.fx ? "全部效果 ▴" : "全部效果 ▾", this.fx, (_e, cx) => { this.fx = !this.fx; cx.notify(); })));
      if (this.fx) {
        body.child(h_flex().flex_wrap().gap(4).children(this.modes.map((m) => {
          const on = m === vis;
          return div().id(`fx-${m}`).h(24).px(8).flex().items_center().rounded(5).text_size(11)
            .bg(on ? t.selected : t.raised).text_color(on ? t.foreground : t.muted)
            .hover((x) => x.bg(t.hover).text_color(t.foreground))
            .on_mouse_down("left", stop).on_click((_e, cx) => this.act(cx, "vis", m)).child(m === "None" ? "关闭" : m);
        })));
      }
      body.child(h_flex().gap(6)
        .child(this.chip("cl-go", "跳到标签", false, () => term && run("pane.focus", { terminal: term.address })))
        .child(this.chip("cl-sw", "切换来源", false, (_e, cx) => this.stopAll(cx)))
        .child(this.chip("cl-stop", "关闭播放", false, (_e, cx) => this.stopAll(cx))));
    }

    return v_flex().w(300).bg(t.surface).border_1().border_color(t.border).rounded(12)
      .child(this.titleBar(cx, term ? null : ""))
      .child(body);
  }

  // Stop playback, then close the cliamp tab (its terminal).
  stopAll(cx) {
    cx.spawn(async (cx) => {
      await ctl("stop");
      const term = cliampTerminal();
      if (term) run("terminal.kill", { terminal: term.address });
      this.snap = null; this.startedAt = 0; cx.notify();
    });
  }

  volume(cx, delta) {
    cx.spawn(async (cx) => {
      const r = await ctl("status");
      const m = /Volume:\s*(-?[\d.]+)/.exec(r?.stdout ?? "");
      const cur = m ? parseFloat(m[1]) : 0;
      await ctl("volume", String(Math.max(-30, Math.min(6, cur + delta))));
      cx.notify();
    });
  }
}
