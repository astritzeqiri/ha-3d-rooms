var e = (e) => e === 3 || e?.error?.code === 3;
// node_modules/home-assistant-js-websocket/dist/messages.js
function t(e) {
	return {
		type: "auth",
		access_token: e
	};
}
function n() {
	return {
		type: "supported_features",
		id: 1,
		features: { coalesce_messages: 1 }
	};
}
function r() {
	return { type: "get_states" };
}
function i() {
	return { type: "get_config" };
}
function a(e, t, n, r, i) {
	let a = {
		type: "call_service",
		domain: e,
		service: t,
		target: r,
		return_response: i
	};
	return n && (a.service_data = n), a;
}
function o(e) {
	let t = { type: "subscribe_events" };
	return e && (t.event_type = e), t;
}
function s(e) {
	return {
		type: "unsubscribe_events",
		subscription: e
	};
}
function c() {
	return { type: "ping" };
}
function l(e, t) {
	return {
		type: "result",
		success: !1,
		error: {
			code: e,
			message: t
		}
	};
}
// node_modules/home-assistant-js-websocket/dist/util.js
function u(e) {
	let t = {}, n = e.split("&");
	for (let e = 0; e < n.length; e++) {
		let r = n[e].split("="), i = decodeURIComponent(r[0]);
		t[i] = r.length > 1 ? decodeURIComponent(r[1]) : void 0;
	}
	return t;
}
var d = (e, t, n, r) => {
	let [i, a, o] = e.split(".", 3);
	return Number(i) > t || Number(i) === t && (r === void 0 ? Number(a) >= n : Number(a) > n) || r !== void 0 && Number(i) === t && Number(a) === n && Number(o) >= r;
}, f = 1e4, p = "auth_invalid", m = "auth_ok";
function h(e) {
	if (!e.auth) throw 4;
	let r = e.auth, i = r.expired ? r.refreshAccessToken().then(() => {
		i = void 0;
	}, () => {
		i = void 0;
	}) : void 0, a = r.wsUrl, o = e.connectTimeout ?? f;
	function s(e, c, l) {
		let u = new WebSocket(a), f = !1, h = o > 0 ? setTimeout(() => {
			u.close();
		}, o) : void 0, g = () => {
			h !== void 0 && clearTimeout(h);
		}, _ = () => {
			if (g(), u.removeEventListener("close", _), f) {
				l(2);
				return;
			}
			if (e === 0) {
				l(1);
				return;
			}
			let t = e === -1 ? -1 : e - 1;
			setTimeout(() => s(t, c, l), 1e3);
		}, v = async (e) => {
			g();
			try {
				r.expired && await (i || r.refreshAccessToken()), u.send(JSON.stringify(t(r.accessToken)));
			} catch (e) {
				f = e === 2, u.close();
			}
		}, y = async (e) => {
			let t = JSON.parse(e.data);
			switch (t.type) {
				case p:
					f = !0, u.close();
					break;
				case m: u.removeEventListener("open", v), u.removeEventListener("message", y), u.removeEventListener("close", _), u.removeEventListener("error", _), u.haVersion = t.ha_version, d(u.haVersion, 2022, 9) && u.send(JSON.stringify(n())), c(u);
			}
		};
		u.addEventListener("open", v), u.addEventListener("message", y), u.addEventListener("close", _), u.addEventListener("error", _);
	}
	return new Promise((t, n) => s(e.setupRetry, t, n));
}
// node_modules/home-assistant-js-websocket/dist/connection.js
var g = () => l(3, "Connection lost"), _ = class {
	constructor(e, t) {
		this._socketWaiters = [], this._reconnectFailed = !1, this._handleMessage = (e) => {
			let t = JSON.parse(e.data);
			Array.isArray(t) || (t = [t]), t.forEach((e) => {
				let t = this.commands.get(e.id);
				switch (e.type) {
					case "event":
						t ? t.callback(e.event) : (console.warn(`Received event for unknown subscription ${e.id}. Unsubscribing.`), this.sendMessagePromise(s(e.id)).catch((e) => {}));
						break;
					case "result":
						t && (e.success ? (t.resolve(e.result), "subscribe" in t || this.commands.delete(e.id)) : (t.reject(e.error), this.commands.delete(e.id)));
						break;
					case "pong": t ? (t.resolve(), this.commands.delete(e.id)) : console.warn(`Received unknown pong response ${e.id}`);
				}
			});
		}, this._handleClose = async () => {
			let e = this.commands;
			if (this.commandId = 1, this.oldSubscriptions = this.commands, this.commands = /* @__PURE__ */ new Map(), this.socket = void 0, e.forEach((e) => {
				"subscribe" in e && e.subscribe || e.reject(g());
			}), this.closeRequested) {
				this._rejectWaiting();
				return;
			}
			this.fireEvent("disconnected");
			let t = Object.assign(Object.assign({}, this.options), { setupRetry: 0 }), n = (e) => {
				setTimeout(async () => {
					if (this.closeRequested) {
						this._rejectWaiting();
						return;
					}
					let r;
					try {
						r = await t.createSocket(t);
					} catch (t) {
						if (this.closeRequested) {
							this._rejectWaiting();
							return;
						}
						this._rejectQueuedMessages(), t === 2 ? (this._reconnectFailed = !0, this._rejectWaiting(), this.fireEvent("reconnect-error", t)) : n(e + 1);
						return;
					}
					this.closeRequested ? (r.close(), this._rejectWaiting()) : this._setSocket(r);
				}, Math.min(e, 5) * 1e3);
			};
			this.suspendReconnectPromise && (await this.suspendReconnectPromise, this.suspendReconnectPromise = void 0, this._queuedMessages = []), n(0);
		}, this.options = t, this.commandId = 2, this.commands = /* @__PURE__ */ new Map(), this.eventListeners = /* @__PURE__ */ new Map(), this.closeRequested = !1, this._setSocket(e);
	}
	get connected() {
		return this.socket !== void 0 && this.socket.readyState == this.socket.OPEN;
	}
	_setSocket(e) {
		this.socket = e, this.haVersion = e.haVersion, e.addEventListener("message", this._handleMessage), e.addEventListener("close", this._handleClose);
		let t = this._queuedMessages;
		if (t) {
			this._queuedMessages = void 0;
			for (let e of t) e.resolve();
		}
		let n = this.oldSubscriptions;
		n && (this.oldSubscriptions = void 0, n.forEach((e) => {
			if ("subscribe" in e && e.subscribe) {
				let t = e.subscribe();
				e.unsubscribe = () => t.then((e) => e(), () => void 0), t.then(() => e.resolve(), (t) => e.reject(t));
			}
		}));
		let r = this._socketWaiters;
		this._socketWaiters = [];
		for (let e of r) e.resolve();
		this.fireEvent("ready");
	}
	addEventListener(e, t) {
		let n = this.eventListeners.get(e);
		n || (n = [], this.eventListeners.set(e, n)), n.push(t);
	}
	removeEventListener(e, t) {
		let n = this.eventListeners.get(e);
		if (!n) return;
		let r = n.indexOf(t);
		r !== -1 && n.splice(r, 1);
	}
	fireEvent(e, t) {
		(this.eventListeners.get(e) || []).forEach((e) => e(this, t));
	}
	suspendReconnectUntil(e) {
		this.suspendReconnectPromise = e;
	}
	suspend() {
		if (!this.suspendReconnectPromise) throw Error("Suspend promise not set");
		this.socket && this.socket.close();
	}
	reconnect(e = !1) {
		this.socket && (e ? (this.socket.removeEventListener("message", this._handleMessage), this.socket.removeEventListener("close", this._handleClose), this.socket.close(), this._handleClose()) : this.socket.close());
	}
	close() {
		this.closeRequested = !0, this.socket && this.socket.close(), this._rejectWaiting();
	}
	async subscribeEvents(e, t) {
		return this.subscribeMessage(e, o(t));
	}
	ping() {
		return this.sendMessagePromise(c());
	}
	sendMessage(e, t) {
		if (!this.connected) throw 3;
		if (this._queuedMessages) {
			if (t) throw Error("Cannot queue with commandId");
			this._queuedMessages.push({ resolve: () => this.sendMessage(e) });
		} else t ||= this._genCmdId(), e.id = t, this.socket.send(JSON.stringify(e));
	}
	sendMessagePromise(e) {
		return new Promise((t, n) => {
			if (this._queuedMessages) {
				this._queuedMessages.push({
					reject: n,
					resolve: async () => {
						try {
							t(await this.sendMessagePromise(e));
						} catch (e) {
							n(e);
						}
					}
				});
				return;
			}
			let r = this._genCmdId();
			this.commands.set(r, {
				resolve: t,
				reject: n
			});
			try {
				this.sendMessage(e, r);
			} catch (e) {
				this.commands.delete(r), n(e === 3 ? g() : e);
			}
		});
	}
	async subscribeMessage(t, n, r) {
		if (this._isUsable || await this._waitForSocket(), r?.preCheck) {
			if (!await r.preCheck()) throw Error("Pre-check failed");
			this._isUsable || await this._waitForSocket();
		}
		let i;
		return await new Promise((a, o) => {
			let c = this._genCmdId();
			i = {
				resolve: a,
				reject: o,
				callback: t,
				subscribe: r?.resubscribe === !1 ? void 0 : () => this.subscribeMessage(t, n, r),
				unsubscribe: async () => {
					try {
						this.connected && this.commands.get(c) === i && await this.sendMessagePromise(s(c));
					} catch (t) {
						if (!e(t)) throw t;
					} finally {
						this.commands.get(c) === i && this.commands.delete(c), this.oldSubscriptions?.get(c) === i && this.oldSubscriptions.delete(c);
					}
				}
			}, this.commands.set(c, i);
			try {
				this.sendMessage(n, c);
			} catch {}
		}), () => i.unsubscribe();
	}
	get _isUsable() {
		return this.socket !== void 0 && !this.closeRequested;
	}
	async _waitForSocket() {
		for (; !this._isUsable;) {
			if (this.closeRequested || this._reconnectFailed) throw g();
			await new Promise((e, t) => {
				this._socketWaiters.push({
					resolve: e,
					reject: t
				});
			});
		}
	}
	_rejectQueuedMessages() {
		let e = this._queuedMessages;
		if (e) {
			this._queuedMessages = void 0;
			for (let t of e) t.reject && t.reject(g());
		}
	}
	_rejectWaiting() {
		var e;
		this._rejectQueuedMessages();
		let t = this._socketWaiters;
		this._socketWaiters = [];
		for (let e of t) e.reject(g());
		(e = this.oldSubscriptions) == null || e.forEach((e) => e.reject(g()));
	}
	_genCmdId() {
		return ++this.commandId;
	}
}, v = () => `${location.protocol}//${location.host}/`, y = (e) => e * 1e3 + Date.now(), b = "hass_oauth_state_";
function x(e) {
	return btoa(String.fromCharCode(...e)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function S(e) {
	if (!crypto.subtle) return !1;
	try {
		let t = await fetch(`${e}/.well-known/oauth-authorization-server`);
		if (!t.ok) return !1;
		let n = await t.json();
		return Array.isArray(n?.code_challenge_methods_supported) && n.code_challenge_methods_supported.includes("S256");
	} catch {
		return !1;
	}
}
function C() {
	let { protocol: e, host: t, pathname: n, search: r } = location;
	return `${e}//${t}${n}${r}`;
}
function w(e, t, n, r, i) {
	let a = `${e}/auth/authorize?response_type=code&redirect_uri=${encodeURIComponent(n)}`;
	return t !== null && (a += `&client_id=${encodeURIComponent(t)}`), r && (a += `&state=${encodeURIComponent(r)}`), i !== void 0 && (a += `&code_challenge=${encodeURIComponent(i)}`, a += "&code_challenge_method=S256"), a;
}
async function T(e, t, n) {
	n += (n.includes("?") ? "&" : "?") + "auth_callback=1";
	let r = {
		hassUrl: e,
		clientId: t
	}, i = O(r), a;
	if (await S(e)) {
		let e = x(crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(64))), t = x(crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(32))), n = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(e));
		a = x(new Uint8Array(n)), i = O(Object.assign(Object.assign({}, r), { nonce: t })), sessionStorage.setItem(`${b}${t}`, JSON.stringify({
			codeVerifier: e,
			state: i
		}));
	}
	document.location.href = w(e, t, n, i, a);
}
async function E(e, t, n) {
	let r = typeof location < "u" && location;
	if (r && r.protocol === "https:") {
		let t = document.createElement("a");
		if (t.href = e, t.protocol === "http:" && t.hostname !== "localhost") throw 5;
	}
	let i = new FormData();
	t !== null && i.append("client_id", t), Object.keys(n).forEach((e) => {
		let t = n[e];
		t !== void 0 && i.append(e, t);
	});
	let a = await fetch(`${e}/auth/token`, {
		method: "POST",
		credentials: "same-origin",
		body: i
	});
	if (!a.ok) throw a.status === 400 || a.status === 403 ? 2 : /* @__PURE__ */ Error("Unable to fetch tokens");
	let o = await a.json();
	return o.hassUrl = e, o.clientId = t, o.expires = y(o.expires_in), o;
}
function D(e, t, n, r) {
	return E(e, t, {
		code: n,
		code_verifier: r,
		grant_type: "authorization_code"
	});
}
function O(e) {
	return btoa(JSON.stringify(e));
}
function k(e) {
	return JSON.parse(atob(e));
}
var A = class {
	constructor(e, t) {
		this.data = e, this._saveTokens = t;
	}
	get wsUrl() {
		return `ws${this.data.hassUrl.substr(4)}/api/websocket`;
	}
	get accessToken() {
		return this.data.access_token;
	}
	get expired() {
		return Date.now() > this.data.expires;
	}
	async refreshAccessToken() {
		if (!this.data.refresh_token) throw Error("No refresh_token");
		let e = await E(this.data.hassUrl, this.data.clientId, {
			grant_type: "refresh_token",
			refresh_token: this.data.refresh_token
		});
		e.refresh_token = this.data.refresh_token, this.data = e, this._saveTokens && this._saveTokens(e);
	}
	async revoke() {
		if (!this.data.refresh_token) throw Error("No refresh_token to revoke");
		let e = new FormData();
		e.append("token", this.data.refresh_token), await fetch(`${this.data.hassUrl}/auth/revoke`, {
			method: "POST",
			credentials: "same-origin",
			body: e
		}), this._saveTokens && this._saveTokens(null);
	}
};
async function j(e = {}) {
	let t, n = e.hassUrl;
	n && n[n.length - 1] === "/" && (n = n.substr(0, n.length - 1));
	let r = e.clientId === void 0 ? v() : e.clientId, i = e.limitHassInstance === !0;
	if (e.authCode && n && (t = await D(n, r, e.authCode), e.saveTokens && e.saveTokens(t)), !t) {
		let a = u(location.search.substr(1));
		if ("auth_callback" in a) {
			let o = k(a.state);
			if (i && (o.hassUrl !== n || o.clientId !== r)) throw 6;
			let s = null;
			if (o.nonce !== void 0) {
				let e = `${b}${o.nonce}`;
				try {
					let t = sessionStorage.getItem(e);
					sessionStorage.removeItem(e), s = JSON.parse(t);
				} catch {
					throw 6;
				}
				if (s?.state !== a.state) throw 6;
			}
			t = await D(o.hassUrl, o.clientId, a.code, s?.codeVerifier), e.saveTokens && e.saveTokens(t);
		}
	}
	if (!t && e.loadTokens && (t = await e.loadTokens()), t && (n === void 0 || t.hassUrl === n)) return new A(t, e.saveTokens);
	if (n === void 0) throw 4;
	return await T(n, r, e.redirectUrl || C()), new Promise(() => {});
}
// node_modules/home-assistant-js-websocket/dist/store.js
var ee = (e) => {
	let t = [];
	function n(e) {
		let n = [];
		for (let r = 0; r < t.length; r++) t[r] === e ? e = null : n.push(t[r]);
		t = n;
	}
	function r(n, r) {
		e = r ? n : Object.assign(Object.assign({}, e), n);
		let i = t;
		for (let t = 0; t < i.length; t++) i[t](e);
	}
	return {
		get state() {
			return e;
		},
		action(t) {
			function n(e) {
				r(e, !1);
			}
			return function() {
				let r = [e];
				for (let e = 0; e < arguments.length; e++) r.push(arguments[e]);
				let i = t.apply(this, r);
				if (i != null) return i instanceof Promise ? i.then(n) : n(i);
			};
		},
		setState: r,
		clearState() {
			e = void 0;
		},
		subscribe(e) {
			return t.push(e), () => {
				n(e);
			};
		}
	};
}, M = 5e3, N = (t, n, r, i, a = { unsubGrace: !0 }) => {
	if (t[n]) return t[n];
	let o = 0, s, c, l = ee(), u = () => {
		if (!r) throw Error("Collection does not support refresh");
		return r(t).then((e) => l.setState(e, !0));
	}, d = () => u().catch((e) => {
		if (t.connected) throw e;
	}), f = () => {
		c === void 0 ? (i && (s = i(t, l), s.catch((t) => {
			if (!e(t)) throw t;
		})), r && (t.addEventListener("ready", d), d()), t.addEventListener("disconnected", h)) : (clearTimeout(c), c = void 0);
	}, p = () => {
		c = void 0, s && s.then((e) => {
			e();
		}, () => void 0), l.clearState(), t.removeEventListener("ready", d), t.removeEventListener("disconnected", h);
	}, m = () => {
		c = setTimeout(p, M);
	}, h = () => {
		c && (clearTimeout(c), p());
	};
	return t[n] = {
		get state() {
			return l.state;
		},
		refresh: u,
		subscribe(e) {
			o++, o === 1 && f();
			let t = l.subscribe(e);
			return l.state !== void 0 && setTimeout(() => e(l.state), 0), () => {
				t(), o--, o || (a.unsubGrace ? m() : p());
			};
		}
	}, t[n];
}, te = (e) => e.sendMessagePromise(r()), ne = (e) => e.sendMessagePromise(i()), re = (e, t, n, r, i, o) => e.sendMessagePromise(a(t, n, r, i, o));
// node_modules/home-assistant-js-websocket/dist/entities.js
function ie(e, t, n) {
	let r = n ? {} : Object.assign({}, e.state);
	if (t.a) for (let e in t.a) {
		let n = t.a[e], i = (/* @__PURE__ */ new Date(n.lc * 1e3)).toISOString();
		r[e] = {
			entity_id: e,
			state: n.s,
			attributes: n.a,
			context: typeof n.c == "string" ? {
				id: n.c,
				parent_id: null,
				user_id: null
			} : n.c,
			last_changed: i,
			last_updated: n.lu ? (/* @__PURE__ */ new Date(n.lu * 1e3)).toISOString() : i
		};
	}
	if (t.r) for (let e of t.r) delete r[e];
	if (t.c) for (let e in t.c) {
		let n = r[e];
		if (!n) {
			console.warn("Received state update for unknown entity", e);
			continue;
		}
		n = Object.assign({}, n);
		let { "+": i, "-": a } = t.c[e], o = i?.a || a?.a, s = o ? Object.assign({}, n.attributes) : n.attributes;
		if (i && (i.s !== void 0 && (n.state = i.s), i.c && (typeof i.c == "string" ? n.context = Object.assign(Object.assign({}, n.context), { id: i.c }) : n.context = Object.assign(Object.assign({}, n.context), i.c)), i.lc ? n.last_updated = n.last_changed = (/* @__PURE__ */ new Date(i.lc * 1e3)).toISOString() : i.lu && (n.last_updated = (/* @__PURE__ */ new Date(i.lu * 1e3)).toISOString()), i.a && Object.assign(s, i.a)), a?.a) for (let e of a.a) delete s[e];
		o && (n.attributes = s), r[e] = n;
	}
	e.setState(r, !0);
}
var ae = async (e, t) => {
	let n = !0, r = () => {
		n = !0;
	};
	e.addEventListener("ready", r);
	try {
		let i = await e.subscribeMessage((e) => {
			ie(t, e, n), n = !1;
		}, { type: "subscribe_entities" });
		return () => {
			e.removeEventListener("ready", r), i();
		};
	} catch (t) {
		throw e.removeEventListener("ready", r), t;
	}
};
function oe(e, t) {
	let n = e.state;
	if (n === void 0) return;
	let { entity_id: r, new_state: i } = t.data;
	if (i) e.setState({ [i.entity_id]: i });
	else {
		let t = Object.assign({}, n);
		delete t[r], e.setState(t, !0);
	}
}
async function se(e) {
	let t = await te(e), n = {};
	for (let e = 0; e < t.length; e++) {
		let r = t[e];
		n[r.entity_id] = r;
	}
	return n;
}
var ce = (e, t) => e.subscribeEvents((e) => oe(t, e), "state_changed"), le = (e) => d(e.haVersion, 2022, 4, 0) ? N(e, "_ent", void 0, ae) : N(e, "_ent", se, ce), ue = (e, t) => le(e).subscribe(t);
// node_modules/home-assistant-js-websocket/dist/index.js
async function de(e) {
	let t = Object.assign({
		setupRetry: 0,
		createSocket: h
	}, e);
	return new _(await t.createSocket(t), t);
}
// dashboard/standalone-hass.mjs
function fe({ auth: e, connection: t, user: n, config: r, origin: i, onChange: a, fetcher: o = (...e) => fetch(...e) }) {
	let s = {}, c = !0, l = () => ({
		states: s,
		user: n,
		config: r,
		auth: e,
		connection: t,
		connected: c,
		callWS: (e) => t.sendMessagePromise(e),
		callService: (e, n, r, i) => re(t, e, n, r, i),
		hassUrl: (e = "") => new URL(e, i).toString(),
		fetchWithAuth: async (t, n = {}) => {
			e.expired && await e.refreshAccessToken();
			let r = new Headers(n.headers);
			return r.set("Authorization", `Bearer ${e.accessToken}`), o(new URL(t, i), {
				...n,
				headers: r
			});
		}
	}), u = () => a(l());
	return {
		build: l,
		setStates(e) {
			s = e, u();
		},
		setConnected(e) {
			c !== e && (c = e, u());
		}
	};
}
var pe = (e) => ({
	loadTokens() {
		try {
			return JSON.parse(e.getItem("hassTokens"));
		} catch {
			return null;
		}
	},
	saveTokens(t) {
		try {
			t ? e.setItem("hassTokens", JSON.stringify(t)) : e.removeItem("hassTokens");
		} catch {}
	}
}), P = {
	"mdi:lightbulb": "M12,2A7,7 0 0,0 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H15A1,1 0 0,0 16,17V14.74C17.81,13.47 19,11.38 19,9A7,7 0 0,0 12,2M9,21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9V21Z",
	"mdi:lightbulb-outline": "M12,2A7,7 0 0,1 19,9C19,11.38 17.81,13.47 16,14.74V17A1,1 0 0,1 15,18H9A1,1 0 0,1 8,17V14.74C6.19,13.47 5,11.38 5,9A7,7 0 0,1 12,2M9,21V20H15V21A1,1 0 0,1 14,22H10A1,1 0 0,1 9,21M12,4A5,5 0 0,0 7,9C7,11.05 8.23,12.81 10,13.58V16H14V13.58C15.77,12.81 17,11.05 17,9A5,5 0 0,0 12,4Z",
	"mdi:ceiling-light": "M8,9H11V4H13V9H16L20,17H4L8,9M14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18H14Z",
	"mdi:lamp": "M8,2H16L20,14H4L8,2M11,15H13V20H18V22H6V20H11V15Z",
	"mdi:floor-lamp": "M15,2L17,9H7L9,2M11,10H13V20H16V22H8V20H11V10Z",
	"mdi:desk-lamp": "M10.85,2L9.18,4.5L10.32,5.25L7.14,10C7.1,10 7.05,10 7,10A2,2 0 0,0 5,12C5,12.94 5.66,13.75 6.58,13.95L10.62,20H7V22H17V20H13L8.53,13.28C8.83,12.92 9,12.47 9,12C9,11.7 8.93,11.4 8.8,11.13L12,6.37C11.78,8.05 12.75,9.89 14.45,11L18.89,4.37C17.2,3.24 15.12,3.04 13.65,3.87L10.85,2M18.33,7L16.67,9.5C17.35,9.95 18.29,9.77 18.75,9.08C19.21,8.39 19,7.46 18.33,7Z",
	"mdi:wall-sconce": "M11,4L7,13H19L15,4H11M4,14V22H6V19H14V14H12V17H6V14H4Z",
	"mdi:outdoor-lamp": "M15 22H13C11.9 22 11 21.1 11 20V15H17V20C17 21.1 16.1 22 15 22M7 14H21L15 9.71V6C15 4.39 13.94 2 11 2S7 4.39 7 6C7 6.45 6.81 7 6 7H5V3H3V12H5V9H6C8.2 9 9 7.21 9 6C9 5.67 9.1 4 11 4C12.83 4 13 5.54 13 6V9.71L7 14Z",
	"mdi:led-strip": "M2.81,8.46L14.83,20.5L15.54,19.78L16.95,21.19L18.36,19.78L16.95,18.36L18.36,16.95L19.78,18.36L21.19,16.95L19.78,15.54L20.5,14.83L8.46,2.81L2.81,8.46M5.64,8.46L8.46,5.64L17.66,14.83L14.83,17.66L5.64,8.46M7.05,8.46L8.46,9.88L9.88,8.46L8.46,7.05L7.05,8.46M9.17,10.59L10.59,12L12,10.59L10.59,9.17L9.17,10.59M11.29,12.71L12.71,14.12L14.12,12.71L12.71,11.29L11.29,12.71M13.41,14.83L14.83,16.24L16.24,14.83L14.83,13.41L13.41,14.83Z",
	"mdi:string-lights": "M22.56 11.39C22.36 10.59 21.82 9.85 21.05 9.44L20.63 7.74C21.11 7.58 21.57 7.41 22 7.23V5C20 6.07 16.53 7.03 12 7.03S4 6.07 2 5V7.23C2.43 7.41 2.89 7.58 3.37 7.74L2.95 9.44C2.18 9.85 1.64 10.59 1.44 11.39C.905 13.57 .385 17.31 2.92 17.93C4 18.2 6 17.89 7.27 12.82C7.46 12 7.33 11.12 6.84 10.39L7.26 8.67C8.14 8.81 9.05 8.9 10 8.96V10.74C9.35 11.33 9 12.17 9 13C9 15.24 9.39 19 12 19C13.12 19 15 18.22 15 13C15 12.17 14.65 11.33 14 10.74V8.96C14.95 8.9 15.86 8.81 16.74 8.67L17.16 10.39C16.67 11.12 16.54 12 16.73 12.82C18 17.89 20 18.2 21.08 17.93C23.61 17.31 23.09 13.57 22.56 11.39M5.81 12.47C5.81 12.47 4.74 16.84 3.28 16.5C1.82 16.12 2.9 11.75 2.9 11.75S3.26 10.29 4.71 10.65 5.81 12.47 5.81 12.47M12 17.5C10.5 17.5 10.5 13 10.5 13S10.5 11.5 12 11.5 13.5 13 13.5 13 13.5 17.5 12 17.5M20.72 16.5C19.27 16.84 18.19 12.47 18.19 12.47S17.83 11 19.29 10.65 21.1 11.75 21.1 11.75 22.18 16.12 20.72 16.5Z",
	"mdi:door": "M8,3C6.89,3 6,3.89 6,5V21H18V5C18,3.89 17.11,3 16,3H8M8,5H16V19H8V5M13,11V13H15V11H13Z",
	"mdi:door-open": "M12,3C10.89,3 10,3.89 10,5H3V19H2V21H22V19H21V5C21,3.89 20.11,3 19,3H12M12,5H19V19H12V5M5,11H7V13H5V11Z",
	"mdi:door-sliding": "M10 13H8V11H10V13M16 11H14V13H16V11M21 19V21H3V19H4V5C4 3.9 4.9 3 6 3H18C19.1 3 20 3.9 20 5V19H21M11 5H6V19H11V5M18 5H13V19H18V5Z",
	"mdi:garage": "M19,20H17V11H7V20H5V9L12,5L19,9V20M8,12H16V14H8V12M8,15H16V17H8V15M16,18V20H8V18H16Z",
	"mdi:window-closed-variant": "M21 20V2H3V20H1V23H23V20M19 4V11H13V4M5 4H11V11H5M5 20V13H11V20M13 20V13H19V20Z",
	"mdi:window-open-variant": "M21 20V2H3V20H1V23H23V20M19 4V11H17V4M5 4H7V11H5M5 20V13H7V20M9 20V4H15V20M17 20V13H19V20Z",
	"mdi:blinds-horizontal": "M20 19V3H4V19H2V21H22V19H20M16 9H18V11H16V9M14 11H6V9H14V11M18 7H16V5H18V7M14 5V7H6V5H14M6 19V13H14V14.82C13.55 15.14 13.25 15.66 13.25 16.25C13.25 17.22 14.03 18 15 18S16.75 17.22 16.75 16.25C16.75 15.66 16.45 15.13 16 14.82V13H18V19H6Z",
	"mdi:roller-shade": "M20 19V3H4V19H2V21H22V19H20M6 19V13H11V14.8C10.6 15.1 10.2 15.6 10.2 16.2C10.2 17.2 11 18 12 18S13.8 17.2 13.8 16.2C13.8 15.6 13.5 15.1 13 14.8V13H18V19H6Z",
	"mdi:curtains": "M23 3H1V1H23V3M2 22H6C6 19 4 17 4 17C10 13 11 4 11 4H2V22M22 4H13C13 4 14 13 20 17C20 17 18 19 18 22H22V4Z",
	"mdi:lock": "M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z",
	"mdi:lock-open-variant": "M18 1C15.24 1 13 3.24 13 6V8H4C2.9 8 2 8.89 2 10V20C2 21.11 2.9 22 4 22H16C17.11 22 18 21.11 18 20V10C18 8.9 17.11 8 16 8H15V6C15 4.34 16.34 3 18 3C19.66 3 21 4.34 21 6V8H23V6C23 3.24 20.76 1 18 1M10 13C11.1 13 12 13.89 12 15C12 16.11 11.11 17 10 17C8.9 17 8 16.11 8 15C8 13.9 8.9 13 10 13Z",
	"mdi:air-conditioner": "M6.59,0.66C8.93,-1.15 11.47,1.06 12.04,4.5C12.47,4.5 12.89,4.62 13.27,4.84C13.79,4.24 14.25,3.42 14.07,2.5C13.65,0.35 16.06,-1.39 18.35,1.58C20.16,3.92 17.95,6.46 14.5,7.03C14.5,7.46 14.39,7.89 14.16,8.27C14.76,8.78 15.58,9.24 16.5,9.06C18.63,8.64 20.38,11.04 17.41,13.34C15.07,15.15 12.53,12.94 11.96,9.5C11.53,9.5 11.11,9.37 10.74,9.15C10.22,9.75 9.75,10.58 9.93,11.5C10.35,13.64 7.94,15.39 5.65,12.42C3.83,10.07 6.05,7.53 9.5,6.97C9.5,6.54 9.63,6.12 9.85,5.74C9.25,5.23 8.43,4.76 7.5,4.94C5.37,5.36 3.62,2.96 6.59,0.66M5,16H7A2,2 0 0,1 9,18V24H7V22H5V24H3V18A2,2 0 0,1 5,16M5,18V20H7V18H5M12.93,16H15L12.07,24H10L12.93,16M18,16H21V18H18V22H21V24H18A2,2 0 0,1 16,22V18A2,2 0 0,1 18,16Z",
	"mdi:fan": "M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11M12.5,2C17,2 17.11,5.57 14.75,6.75C13.76,7.24 13.32,8.29 13.13,9.22C13.61,9.42 14.03,9.73 14.35,10.13C18.05,8.13 22.03,8.92 22.03,12.5C22.03,17 18.46,17.1 17.28,14.73C16.78,13.74 15.72,13.3 14.79,13.11C14.59,13.59 14.28,14 13.88,14.34C15.87,18.03 15.08,22 11.5,22C7,22 6.91,18.42 9.27,17.24C10.25,16.75 10.69,15.71 10.89,14.79C10.4,14.59 9.97,14.27 9.65,13.87C5.96,15.85 2,15.07 2,11.5C2,7 5.56,6.89 6.74,9.26C7.24,10.25 8.29,10.68 9.22,10.87C9.41,10.39 9.73,9.97 10.14,9.65C8.15,5.96 8.94,2 12.5,2Z",
	"mdi:thermometer": "M15 13V5A3 3 0 0 0 9 5V13A5 5 0 1 0 15 13M12 4A1 1 0 0 1 13 5V8H11V5A1 1 0 0 1 12 4Z",
	"mdi:radiator": "M7.95,3L6.53,5.19L7.95,7.4H7.94L5.95,10.5L4.22,9.6L5.64,7.39L4.22,5.19L6.22,2.09L7.95,3M13.95,2.89L12.53,5.1L13.95,7.3L13.94,7.31L11.95,10.4L10.22,9.5L11.64,7.3L10.22,5.1L12.22,2L13.95,2.89M20,2.89L18.56,5.1L20,7.3V7.31L18,10.4L16.25,9.5L17.67,7.3L16.25,5.1L18.25,2L20,2.89M2,22V14A2,2 0 0,1 4,12H20A2,2 0 0,1 22,14V22H20V20H4V22H2M6,14A1,1 0 0,0 5,15V17A1,1 0 0,0 6,18A1,1 0 0,0 7,17V15A1,1 0 0,0 6,14M10,14A1,1 0 0,0 9,15V17A1,1 0 0,0 10,18A1,1 0 0,0 11,17V15A1,1 0 0,0 10,14M14,14A1,1 0 0,0 13,15V17A1,1 0 0,0 14,18A1,1 0 0,0 15,17V15A1,1 0 0,0 14,14M18,14A1,1 0 0,0 17,15V17A1,1 0 0,0 18,18A1,1 0 0,0 19,17V15A1,1 0 0,0 18,14Z",
	"mdi:television": "M21,17H3V5H21M21,3H3A2,2 0 0,0 1,5V17A2,2 0 0,0 3,19H8V21H16V19H21A2,2 0 0,0 23,17V5A2,2 0 0,0 21,3Z",
	"mdi:speaker": "M12,12A3,3 0 0,0 9,15A3,3 0 0,0 12,18A3,3 0 0,0 15,15A3,3 0 0,0 12,12M12,20A5,5 0 0,1 7,15A5,5 0 0,1 12,10A5,5 0 0,1 17,15A5,5 0 0,1 12,20M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8C10.89,8 10,7.1 10,6C10,4.89 10.89,4 12,4M17,2H7C5.89,2 5,2.89 5,4V20A2,2 0 0,0 7,22H17A2,2 0 0,0 19,20V4C19,2.89 18.1,2 17,2Z",
	"mdi:power-plug": "M16,7V3H14V7H10V3H8V7H8C7,7 6,8 6,9V14.5L9.5,18V21H14.5V18L18,14.5V9C18,8 17,7 16,7Z",
	"mdi:power": "M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13",
	"mdi:flash": "M7,2V13H10V22L17,10H13L17,2H7Z",
	"mdi:play": "M8,5.14V19.14L19,12.14L8,5.14Z",
	"mdi:desk": "M3 6H21C21.55 6 22 6.45 22 7C22 7.55 21.55 8 21 8V19H19V17H15V19H13V8H5V19H3V8C2.45 8 2 7.55 2 7C2 6.45 2.45 6 3 6M16 10.5V11H18V10.5C18 10.22 17.78 10 17.5 10H16.5C16.22 10 16 10.22 16 10.5M16 14.5V15H18V14.5C18 14.22 17.78 14 17.5 14H16.5C16.22 14 16 14.22 16 14.5Z",
	"mdi:bed": "M19,7H11V14H3V5H1V20H3V17H21V20H23V11A4,4 0 0,0 19,7M7,13A3,3 0 0,0 10,10A3,3 0 0,0 7,7A3,3 0 0,0 4,10A3,3 0 0,0 7,13Z",
	"mdi:sofa": "M12.5 7C12.5 5.89 13.39 5 14.5 5H18C19.1 5 20 5.9 20 7V9.16C18.84 9.57 18 10.67 18 11.97V14H12.5V7M6 11.96V14H11.5V7C11.5 5.89 10.61 5 9.5 5H6C4.9 5 4 5.9 4 7V9.15C5.16 9.56 6 10.67 6 11.96M20.66 10.03C19.68 10.19 19 11.12 19 12.12V15H5V12C5 10.9 4.11 10 3 10S1 10.9 1 12V17C1 18.1 1.9 19 3 19V21H5V19H19V21H21V19C22.1 19 23 18.1 23 17V12C23 10.79 21.91 9.82 20.66 10.03Z",
	"mdi:home": "M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z",
	"mdi:star": "M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z"
}, me = [
	["Lights", [
		[
			"mdi:lightbulb",
			"Bulb",
			P["mdi:lightbulb"]
		],
		[
			"mdi:lightbulb-outline",
			"Bulb outline",
			P["mdi:lightbulb-outline"]
		],
		[
			"mdi:ceiling-light",
			"Ceiling light",
			P["mdi:ceiling-light"]
		],
		[
			"mdi:lamp",
			"Table lamp",
			P["mdi:lamp"]
		],
		[
			"mdi:floor-lamp",
			"Floor lamp",
			P["mdi:floor-lamp"]
		],
		[
			"mdi:desk-lamp",
			"Desk lamp",
			P["mdi:desk-lamp"]
		],
		[
			"mdi:wall-sconce",
			"Wall light",
			P["mdi:wall-sconce"]
		],
		[
			"mdi:outdoor-lamp",
			"Outdoor light",
			P["mdi:outdoor-lamp"]
		],
		[
			"mdi:led-strip",
			"LED strip",
			P["mdi:led-strip"]
		],
		[
			"mdi:string-lights",
			"String lights",
			P["mdi:string-lights"]
		]
	]],
	["Doors & windows", [
		[
			"mdi:door",
			"Door",
			P["mdi:door"]
		],
		[
			"mdi:door-open",
			"Open door",
			P["mdi:door-open"]
		],
		[
			"mdi:door-sliding",
			"Sliding door",
			P["mdi:door-sliding"]
		],
		[
			"mdi:garage",
			"Garage",
			P["mdi:garage"]
		],
		[
			"mdi:window-closed-variant",
			"Window",
			P["mdi:window-closed-variant"]
		],
		[
			"mdi:window-open-variant",
			"Open window",
			P["mdi:window-open-variant"]
		],
		[
			"mdi:blinds-horizontal",
			"Blinds",
			P["mdi:blinds-horizontal"]
		],
		[
			"mdi:roller-shade",
			"Roller shade",
			P["mdi:roller-shade"]
		],
		[
			"mdi:curtains",
			"Curtains",
			P["mdi:curtains"]
		],
		[
			"mdi:lock",
			"Lock",
			P["mdi:lock"]
		],
		[
			"mdi:lock-open-variant",
			"Unlocked",
			P["mdi:lock-open-variant"]
		]
	]],
	["Other", [
		[
			"mdi:air-conditioner",
			"Air conditioner",
			P["mdi:air-conditioner"]
		],
		[
			"mdi:fan",
			"Fan",
			P["mdi:fan"]
		],
		[
			"mdi:thermometer",
			"Thermometer",
			P["mdi:thermometer"]
		],
		[
			"mdi:radiator",
			"Radiator",
			P["mdi:radiator"]
		],
		[
			"mdi:television",
			"TV",
			P["mdi:television"]
		],
		[
			"mdi:speaker",
			"Speaker",
			P["mdi:speaker"]
		],
		[
			"mdi:power-plug",
			"Plug",
			P["mdi:power-plug"]
		],
		[
			"mdi:power",
			"Power",
			P["mdi:power"]
		],
		[
			"mdi:flash",
			"Flash",
			P["mdi:flash"]
		],
		[
			"mdi:play",
			"Play",
			P["mdi:play"]
		],
		[
			"mdi:desk",
			"Desk",
			P["mdi:desk"]
		],
		[
			"mdi:bed",
			"Bed",
			P["mdi:bed"]
		],
		[
			"mdi:sofa",
			"Sofa",
			P["mdi:sofa"]
		],
		[
			"mdi:home",
			"Home",
			P["mdi:home"]
		],
		[
			"mdi:star",
			"Star",
			P["mdi:star"]
		]
	]]
], he = new Map(me.flatMap(([, e]) => e.map(([e, t, n]) => [e, {
	label: t,
	path: n
}])));
function F(e) {
	return "mdi" + e.replace(/^mdi:/, "").split("-").map((e) => e.charAt(0).toUpperCase() + e.slice(1)).join("");
}
// shared/icon-art.mjs
var I = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$/, L = /^-?[\d.]+(?:[\s,]+-?[\d.]+){3}$/, R = "0 0 24 24";
function z({ path: e, secondaryPath: t, viewBox: n } = {}) {
	if (typeof e == "string" && I.test(e)) return {
		viewBox: typeof n == "string" && L.test(n.trim()) ? n.trim() : R,
		html: `${typeof t == "string" && I.test(t) ? `<path d="${t}" opacity="0.5"/>` : ""}<path d="${e}"/>`
	};
}
// dashboard/standalone-icons.mjs
function ge({ customIcons: e = () => globalThis.window?.customIcons || {}, loadModules: t = async () => {}, loadMdi: n = () => import("./mdi-CGHzqUII.js") } = {}) {
	let r = /* @__PURE__ */ new Map(), i, a = async (r) => {
		let a = r.indexOf(":"), o = r.slice(0, a);
		if (o === "mdi") {
			let e = he.get(r);
			if (e) return {
				viewBox: R,
				html: `<path d="${e.path}"/>`
			};
			let t = (await n())[F(r)];
			return z({ path: t });
		}
		e()[o] || (i ||= Promise.resolve(t()).catch(() => {}), await i);
		let s = e()[o];
		if (typeof s?.getIcon == "function") return z(await s.getIcon(r.slice(a + 1)));
	};
	return { resolve(e) {
		return typeof e != "string" || !e.includes(":") ? Promise.resolve(void 0) : (r.has(e) || r.set(e, a(e).catch(() => void 0)), r.get(e));
	} };
}
function _e(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e?.entities || []) n.ei && typeof n.ic == "string" && t.set(n.ei, n.ic);
	return (e) => t.get(e);
}
function ve({ resolver: e, registryIcon: t = () => void 0 }) {
	if (customElements.get("ha-state-icon")) return;
	class n extends HTMLElement {
		constructor() {
			super(), this.attachShadow({ mode: "open" }).innerHTML = "<style>:host{display:inline-flex}svg{display:block;width:100%;height:100%;fill:currentColor}svg[hidden],slot[hidden]{display:none}</style><slot></slot><svg hidden></svg>", this._svg = this.shadowRoot.querySelector("svg"), this._slot = this.shadowRoot.querySelector("slot"), this._token = 0;
		}
		get icon() {
			return this._icon;
		}
		set icon(e) {
			this._icon = e, this._sync();
		}
		get stateObj() {
			return this._stateObj;
		}
		set stateObj(e) {
			this._stateObj = e, this._sync();
		}
		set hass(e) {
			this._hass = e;
		}
		_sync() {
			let n = this._icon || this._stateObj?.attributes?.icon || t(this._stateObj?.entity_id) || this.dataset.defaultIcon;
			if (n === this._name) return;
			this._name = n;
			let r = ++this._token;
			if (!n) return this._show(void 0);
			e.resolve(n).then((e) => {
				r === this._token && this._show(e);
			});
		}
		_show(e) {
			this._svg.toggleAttribute("hidden", !e), this._slot.hidden = !!e, e && (this._svg.setAttribute("viewBox", e.viewBox), this._svg.innerHTML = e.html);
		}
	}
	customElements.define("ha-state-icon", n);
}
// dashboard/more-info-icons.mjs
var B = {
	close: "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
	power: "M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13",
	palette: "M17.5,12A1.5,1.5 0 0,1 16,10.5A1.5,1.5 0 0,1 17.5,9A1.5,1.5 0 0,1 19,10.5A1.5,1.5 0 0,1 17.5,12M14.5,8A1.5,1.5 0 0,1 13,6.5A1.5,1.5 0 0,1 14.5,5A1.5,1.5 0 0,1 16,6.5A1.5,1.5 0 0,1 14.5,8M9.5,8A1.5,1.5 0 0,1 8,6.5A1.5,1.5 0 0,1 9.5,5A1.5,1.5 0 0,1 11,6.5A1.5,1.5 0 0,1 9.5,8M6.5,12A1.5,1.5 0 0,1 5,10.5A1.5,1.5 0 0,1 6.5,9A1.5,1.5 0 0,1 8,10.5A1.5,1.5 0 0,1 6.5,12M12,3A9,9 0 0,0 3,12A9,9 0 0,0 12,21A1.5,1.5 0 0,0 13.5,19.5C13.5,19.11 13.35,18.76 13.11,18.5C12.88,18.23 12.73,17.88 12.73,17.5A1.5,1.5 0 0,1 14.23,16H16A5,5 0 0,0 21,11C21,6.58 16.97,3 12,3Z",
	thermo: "M15 13V5A3 3 0 0 0 9 5V13A5 5 0 1 0 15 13M12 4A1 1 0 0 1 13 5V8H11V5A1 1 0 0 1 12 4Z",
	effects: "M19,1L17.74,3.75L15,5L17.74,6.26L19,9L20.25,6.26L23,5L20.25,3.75M9,4L6.5,9.5L1,12L6.5,14.5L9,20L11.5,14.5L17,12L11.5,9.5M19,15L17.74,17.74L15,19L17.74,20.25L19,23L20.25,20.25L23,19L20.25,17.74",
	up: "M13,20H11V8L5.5,13.5L4.08,12.08L12,4.16L19.92,12.08L18.5,13.5L13,8V20Z",
	down: "M11,4H13V16L18.5,10.5L19.92,11.92L12,19.84L4.08,11.92L5.5,10.5L11,16V4Z",
	stop: "M18,18H6V6H18V18Z",
	lock: "M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z",
	unlock: "M18 1C15.24 1 13 3.24 13 6V8H4C2.9 8 2 8.89 2 10V20C2 21.11 2.9 22 4 22H16C17.11 22 18 21.11 18 20V10C18 8.9 17.11 8 16 8H15V6C15 4.34 16.34 3 18 3C19.66 3 21 4.34 21 6V8H23V6C23 3.24 20.76 1 18 1M10 13C11.1 13 12 13.89 12 15C12 16.11 11.11 17 10 17C8.9 17 8 16.11 8 15C8 13.9 8.9 13 10 13Z",
	minus: "M19,13H5V11H19V13Z",
	plus: "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z",
	heat: "M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2M14.5 17.5C14.22 17.74 13.76 18 13.4 18.1C12.28 18.5 11.16 17.94 10.5 17.28C11.69 17 12.4 16.12 12.61 15.23C12.78 14.43 12.46 13.77 12.33 13C12.21 12.26 12.23 11.63 12.5 10.94C12.69 11.32 12.89 11.7 13.13 12C13.9 13 15.11 13.44 15.37 14.8C15.41 14.94 15.43 15.08 15.43 15.23C15.46 16.05 15.1 16.95 14.5 17.5H14.5Z",
	cool: "M20.79,13.95L18.46,14.57L16.46,13.44V10.56L18.46,9.43L20.79,10.05L21.31,8.12L19.54,7.65L20,5.88L18.07,5.36L17.45,7.69L15.45,8.82L13,7.38V5.12L14.71,3.41L13.29,2L12,3.29L10.71,2L9.29,3.41L11,5.12V7.38L8.5,8.82L6.5,7.69L5.92,5.36L4,5.88L4.47,7.65L2.7,8.12L3.22,10.05L5.55,9.43L7.55,10.56V13.45L5.55,14.58L3.22,13.96L2.7,15.89L4.47,16.36L4,18.12L5.93,18.64L6.55,16.31L8.55,15.18L11,16.62V18.88L9.29,20.59L10.71,22L12,20.71L13.29,22L14.7,20.59L13,18.88V16.62L15.5,15.17L17.5,16.3L18.12,18.63L20,18.12L19.53,16.35L21.3,15.88L20.79,13.95M9.5,10.56L12,9.11L14.5,10.56V13.44L12,14.89L9.5,13.44V10.56Z",
	heat_cool: "M12.92 1.58L11.18 2.58L12.39 4.67L11.8 6.85L9 7.6L7.38 6L7.42 3.59L5.43 3.59L5.43 5.42L3.59 5.42L3.6 7.42L6 7.42L7.65 9.03L6.9 11.82L4.68 12.4L2.59 11.2L1.59 12.93L3.17 13.84L2.26 15.42L4 16.42L5.19 14.33L7.42 13.75L7.92 14.26L9.32 12.86L8.78 12.32L9.53 9.54L12.32 8.78L12.85 9.32L14.26 7.91L13.73 7.37L14.32 5.19L16.41 4L15.41 2.25L13.83 3.16L12.92 1.58M20.72 4L4 20.72L5.27 22L10.16 17.11C10.63 17.43 11.15 17.68 11.71 17.83C14.38 18.55 17.12 16.96 17.83 14.29C18.22 12.86 17.93 11.36 17.11 10.16L22 5.27L20.72 4M18.74 9C19.18 9.63 19.53 10.38 19.75 11.19C19.97 12 20.03 12.81 19.96 13.61L22.65 10.41L18.74 9M19.32 15.95C19 16.67 18.5 17.35 17.93 17.94C17.34 18.53 16.66 19 15.96 19.34L20.05 20.06L19.32 15.95M9 18.71L10.41 22.66L13.59 19.95C12.81 20 12 19.97 11.19 19.76C10.36 19.54 9.62 19.17 9 18.71Z",
	auto: "M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22C12.4 22 12.7 22 13.1 21.9L15.4 15.3L14.8 14.7C15.5 14 16 13 16 11.9C16 11.2 15.8 10.5 15.4 9.9L17.6 7.7C18.5 9 19 10.4 19 12H20C20.3 12 20.6 12.1 20.8 12.2C20.8 12.2 20.9 12.2 20.9 12.3C21.3 12.5 21.7 12.9 21.9 13.4C22 12.9 22 12.5 22 12C22 6.5 17.5 2 12 2M14 8.6C13.4 8.2 12.7 8 12 8C9.8 8 8 9.8 8 12C8 13.1 8.4 14.1 9.2 14.8L7.1 16.9C5.8 15.7 5 13.9 5 12C5 8.1 8.1 5 12 5C13.6 5 15 5.5 16.2 6.4L14 8.6M20 14H18L14.8 23H16.7L17.4 21H20.6L21.3 23H23.2L20 14M17.8 19.7L19 16L20.2 19.7H17.8Z",
	dry: "M12,3.25C12,3.25 6,10 6,14C6,17.32 8.69,20 12,20A6,6 0 0,0 18,14C18,10 12,3.25 12,3.25M14.47,9.97L15.53,11.03L9.53,17.03L8.47,15.97M9.75,10A1.25,1.25 0 0,1 11,11.25A1.25,1.25 0 0,1 9.75,12.5A1.25,1.25 0 0,1 8.5,11.25A1.25,1.25 0 0,1 9.75,10M14.25,14.5A1.25,1.25 0 0,1 15.5,15.75A1.25,1.25 0 0,1 14.25,17A1.25,1.25 0 0,1 13,15.75A1.25,1.25 0 0,1 14.25,14.5Z",
	fan_only: "M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11M12.5,2C17,2 17.11,5.57 14.75,6.75C13.76,7.24 13.32,8.29 13.13,9.22C13.61,9.42 14.03,9.73 14.35,10.13C18.05,8.13 22.03,8.92 22.03,12.5C22.03,17 18.46,17.1 17.28,14.73C16.78,13.74 15.72,13.3 14.79,13.11C14.59,13.59 14.28,14 13.88,14.34C15.87,18.03 15.08,22 11.5,22C7,22 6.91,18.42 9.27,17.24C10.25,16.75 10.69,15.71 10.89,14.79C10.4,14.59 9.97,14.27 9.65,13.87C5.96,15.85 2,15.07 2,11.5C2,7 5.56,6.89 6.74,9.26C7.24,10.25 8.29,10.68 9.22,10.87C9.41,10.39 9.73,9.97 10.14,9.65C8.15,5.96 8.94,2 12.5,2Z",
	off: "M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13",
	press: "M13 5C15.21 5 17 6.79 17 9C17 10.5 16.2 11.77 15 12.46V11.24C15.61 10.69 16 9.89 16 9C16 7.34 14.66 6 13 6S10 7.34 10 9C10 9.89 10.39 10.69 11 11.24V12.46C9.8 11.77 9 10.5 9 9C9 6.79 10.79 5 13 5M20 20.5C19.97 21.32 19.32 21.97 18.5 22H13C12.62 22 12.26 21.85 12 21.57L8 17.37L8.74 16.6C8.93 16.39 9.2 16.28 9.5 16.28H9.7L12 18V9C12 8.45 12.45 8 13 8S14 8.45 14 9V13.47L15.21 13.6L19.15 15.79C19.68 16.03 20 16.56 20 17.14V20.5M20 2H4C2.9 2 2 2.9 2 4V12C2 13.11 2.9 14 4 14H8V12L4 12L4 4H20L20 12H18V14H20V13.96L20.04 14C21.13 14 22 13.09 22 12V4C22 2.9 21.11 2 20 2Z",
	play: "M8,5.14V19.14L19,12.14L8,5.14Z",
	bulb: "M12,2A7,7 0 0,0 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H15A1,1 0 0,0 16,17V14.74C17.81,13.47 19,11.38 19,9A7,7 0 0,0 12,2M9,21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9V21Z",
	chevron: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
	speed: "M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11M12.5,2C17,2 17.11,5.57 14.75,6.75C13.76,7.24 13.32,8.29 13.13,9.22C13.61,9.42 14.03,9.73 14.35,10.13C18.05,8.13 22.03,8.92 22.03,12.5C22.03,17 18.46,17.1 17.28,14.73C16.78,13.74 15.72,13.3 14.79,13.11C14.59,13.59 14.28,14 13.88,14.34C15.87,18.03 15.08,22 11.5,22C7,22 6.91,18.42 9.27,17.24C10.25,16.75 10.69,15.71 10.89,14.79C10.4,14.59 9.97,14.27 9.65,13.87C5.96,15.85 2,15.07 2,11.5C2,7 5.56,6.89 6.74,9.26C7.24,10.25 8.29,10.68 9.22,10.87C9.41,10.39 9.73,9.97 10.14,9.65C8.15,5.96 8.94,2 12.5,2Z",
	blinds: "M20 19V3H4V19H2V21H22V19H20M16 9H18V11H16V9M14 11H6V9H14V11M18 7H16V5H18V7M14 5V7H6V5H14M6 19V13H14V14.82C13.55 15.14 13.25 15.66 13.25 16.25C13.25 17.22 14.03 18 15 18S16.75 17.22 16.75 16.25C16.75 15.66 16.45 15.13 16 14.82V13H18V19H6Z",
	door: "M8,3C6.89,3 6,3.89 6,5V21H18V5C18,3.89 17.11,3 16,3H8M8,5H16V19H8V5M13,11V13H15V11H13Z",
	toggle: "M17,7H7A5,5 0 0,0 2,12A5,5 0 0,0 7,17H17A5,5 0 0,0 22,12A5,5 0 0,0 17,7M17,15A3,3 0 0,1 14,12A3,3 0 0,1 17,9A3,3 0 0,1 20,12A3,3 0 0,1 17,15Z",
	swing: "M6 14H9L5 18L1 14H4C4 11.3 5.7 6.6 11 6.1V8.1C7.6 8.6 6 11.9 6 14M20 14C20 11.3 18.3 6.6 13 6.1V8.1C16.4 8.7 18 11.9 18 14H15L19 18L23 14H20Z",
	swingh: "M6.45,17.45L1,12L6.45,6.55L7.86,7.96L4.83,11H19.17L16.14,7.96L17.55,6.55L23,12L17.55,17.45L16.14,16.04L19.17,13H4.83L7.86,16.04L6.45,17.45Z",
	preset: "M8 13C6.14 13 4.59 14.28 4.14 16H2V18H4.14C4.59 19.72 6.14 21 8 21S11.41 19.72 11.86 18H22V16H11.86C11.41 14.28 9.86 13 8 13M8 19C6.9 19 6 18.1 6 17C6 15.9 6.9 15 8 15S10 15.9 10 17C10 18.1 9.1 19 8 19M19.86 6C19.41 4.28 17.86 3 16 3S12.59 4.28 12.14 6H2V8H12.14C12.59 9.72 14.14 11 16 11S19.41 9.72 19.86 8H22V6H19.86M16 9C14.9 9 14 8.1 14 7C14 5.9 14.9 5 16 5S18 5.9 18 7C18 8.1 17.1 9 16 9Z",
	fanAuto: "M12.5 2C8.93 2 8.14 5.96 10.13 9.65C9.72 9.97 9.4 10.39 9.21 10.87C8.28 10.68 7.23 10.25 6.73 9.26C5.56 6.89 2 7 2 11.5C2 15.07 5.95 15.85 9.64 13.87C9.96 14.27 10.39 14.59 10.88 14.79C10.68 15.71 10.24 16.75 9.26 17.24C6.9 18.42 7 22 11.5 22C12.31 22 13 21.78 13.5 21.41C13.19 20.67 13 19.86 13 19C13 17.59 13.5 16.3 14.3 15.28C14.17 14.97 14.03 14.65 13.86 14.34C14.26 14 14.57 13.59 14.77 13.11C15.26 13.21 15.78 13.39 16.25 13.67C17.07 13.25 18 13 19 13C20.05 13 21.03 13.27 21.89 13.74C21.95 13.37 22 12.96 22 12.5C22 8.92 18.03 8.13 14.33 10.13C14 9.73 13.59 9.42 13.11 9.22C13.3 8.29 13.74 7.24 14.73 6.75C17.09 5.57 17 2 12.5 2M12 11C12.54 11 13 11.45 13 12C13 12.55 12.54 13 12 13C11.43 13 11 12.55 11 12C11 11.45 11.43 11 12 11M18 15C16.89 15 16 15.9 16 17V23H18V21H20V23H22V17C22 15.9 21.1 15 20 15M18 17H20V19H18Z",
	garage: "M19,20H17V11H7V20H5V9L12,5L19,9V20M8,12H16V14H8V12M8,15H16V17H8V15M16,18V20H8V18H16Z",
	garageOpen: "M19,20H17V11H7V20H5V9L12,5L19,9V20M8,12H16V14H8V12Z",
	shutter: "M3 4H21V8H19V20H17V8H7V20H5V8H3V4M8 9H16V11H8V9M8 12H16V14H8V12M8 15H16V17H8V15M8 18H16V20H8V18Z",
	shutterOpen: "M3 4H21V8H19V20H17V8H7V20H5V8H3V4M8 9H16V11H8V9Z",
	doorClosed: "M16,11H18V13H16V11M12,3H19C20.11,3 21,3.89 21,5V19H22V21H2V19H10V5C10,3.89 10.89,3 12,3M12,5V19H19V5H12Z",
	doorOpen: "M12,3C10.89,3 10,3.89 10,5H3V19H2V21H22V19H21V5C21,3.89 20.11,3 19,3H12M12,5H19V19H12V5M5,11H7V13H5V11Z",
	blindsClosed: "M20 19V3H4V19H2V21H13.25C13.25 21.97 14.03 22.75 15 22.75S16.75 21.97 16.75 21H22V19H20M18 11H16V9H18V11M14 11H6V9H14V11M14 13V15H6V13H14M16 13H18V15H16V13M18 7H16V5H18V7M14 5V7H6V5H14M6 19V17H14V19H6M16 19V17H18V19H16Z",
	blindsOpen: "M20 19V3H4V19H2V21H22V19H20M16 9H18V11H16V9M14 11H6V9H14V11M18 7H16V5H18V7M14 5V7H6V5H14M6 19V13H14V14.82C13.55 15.14 13.25 15.66 13.25 16.25C13.25 17.22 14.03 18 15 18S16.75 17.22 16.75 16.25C16.75 15.66 16.45 15.13 16 14.82V13H18V19H6Z"
}, V = [
	"hs",
	"xy",
	"rgb",
	"rgbw",
	"rgbww"
];
function ye(e) {
	let t = e?.attributes || {}, n = t.supported_color_modes || [], r = e?.entity_id?.startsWith("light."), i = Number.isFinite(t.min_color_temp_kelvin) ? t.min_color_temp_kelvin : 2e3, a = Number.isFinite(t.max_color_temp_kelvin) ? t.max_color_temp_kelvin : 6535;
	return {
		brightness: !!r && n.some((e) => [
			"brightness",
			"color_temp",
			"white",
			...V
		].includes(e)),
		color: !!r && n.some((e) => V.includes(e)),
		temperature: !!r && n.includes("color_temp") && i > 0 && a >= i,
		minKelvin: i,
		maxKelvin: a,
		effects: r && t.supported_features & 4 && Array.isArray(t.effect_list) ? t.effect_list.filter((e) => typeof e == "string") : [],
		transition: !!r && !!(t.supported_features & 32)
	};
}
function H(e) {
	let t = Math.max(1e3, Math.min(4e4, e)) / 100;
	return [
		t <= 66 ? 255 : 329.698727446 * (t - 60) ** -.1332047592,
		t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -.0755148492,
		t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
	].map((e) => Math.round(Math.max(0, Math.min(255, e))));
}
// dashboard/more-info-model.mjs
function be([e, t, n]) {
	let r = Math.max(e, t, n), i = r - Math.min(e, t, n), a = 0;
	return i && (a = r === e ? (t - n) / i % 6 : r === t ? (n - e) / i + 2 : (e - t) / i + 4, a *= 60, a < 0 && (a += 360)), [Math.round(a), Math.round(r ? i / r * 100 : 0)];
}
function xe([e, t], n = 1) {
	let r = t / 100 * n, i = r * (1 - Math.abs(e / 60 % 2 - 1)), a = n - r, [o, s, c] = e < 60 ? [
		r,
		i,
		0
	] : e < 120 ? [
		i,
		r,
		0
	] : e < 180 ? [
		0,
		r,
		i
	] : e < 240 ? [
		0,
		i,
		r
	] : e < 300 ? [
		i,
		0,
		r
	] : [
		r,
		0,
		i
	];
	return [
		o,
		s,
		c
	].map((e) => Math.round((e + a) * 255));
}
function Se(e, t = Date.now()) {
	let n = Date.parse(e);
	if (!Number.isFinite(n)) return "";
	let r = Math.round((n - t) / 1e3);
	if (Math.abs(r) < 45) return "just now";
	let i = new Intl.RelativeTimeFormat(void 0, { numeric: "auto" });
	for (let [e, t] of [
		["day", 86400],
		["hour", 3600],
		["minute", 60]
	]) if (Math.abs(r) >= t) return i.format(Math.round(r / t), e);
	return "just now";
}
function U(e, t = Date.now()) {
	let n = Date.parse(e);
	if (!Number.isFinite(n)) return "";
	let r = Math.round((n - t) / 1e3), i = new Intl.RelativeTimeFormat(void 0, { numeric: "auto" });
	for (let [e, t] of [
		["day", 86400],
		["hour", 3600],
		["minute", 60]
	]) if (Math.abs(r) >= t) return i.format(Math.round(r / t), e);
	return Math.abs(r) < 2 ? "just now" : i.format(r, "second");
}
function Ce(e, t) {
	let n = ["garage", "gate"].includes(e) ? "garage" : e === "door" ? "door" : [
		"blind",
		"shade",
		"curtain"
	].includes(e) ? "blinds" : "shutter";
	return n === "door" ? t ? "doorOpen" : "doorClosed" : t ? `${n}Open` : n === "blinds" ? "blindsClosed" : n;
}
var we = /* @__PURE__ */ new Set([
	"friendly_name",
	"icon",
	"entity_picture",
	"supported_features",
	"supported_color_modes",
	"color_mode",
	"effect_list",
	"hvac_modes",
	"fan_modes",
	"preset_modes",
	"swing_modes",
	"swing_horizontal_modes",
	"attribution",
	"editable",
	"restored"
]);
function Te(e = {}) {
	return Object.entries(e).filter(([e, t]) => !we.has(e) && t !== null && t !== "").slice(0, 14).map(([e, t]) => {
		let n = e.replace(/_/g, " ").replace(/^./, (e) => e.toUpperCase()), r = Array.isArray(t) && t.every((e) => typeof e != "object") ? t.join(", ") : typeof t == "object" ? JSON.stringify(t) : String(t);
		return [n, r.length > 120 ? r.slice(0, 117) + "…" : r];
	});
}
var W = (e) => Number.isFinite(e) ? e : void 0, Ee = /* @__PURE__ */ new Set(["unavailable", "unknown"]);
function De(e) {
	let t = e?.entity_id || "", n = t.split(".")[0], r = e?.attributes || {}, i = {
		id: t,
		domain: n,
		name: r.friendly_name || t,
		state: e?.state,
		unavailable: !e || Ee.has(e.state),
		changed: Se(e?.last_changed),
		since: U(e?.last_changed),
		deviceClass: r.device_class,
		attributes: Te(r),
		controls: []
	};
	if (i.unavailable) return i;
	if (n === "light") {
		let t = ye(e);
		i.controls.push({
			kind: "toggle",
			on: e.state === "on"
		}), t.brightness && i.controls.push({
			kind: "slider",
			key: "brightness",
			label: "Brightness",
			min: 0,
			max: 255,
			step: 1,
			value: e.state === "on" ? W(r.brightness) ?? 0 : 0,
			format: (e) => e > 0 ? `${Math.max(1, Math.round(e / 255 * 100))}%` : "Off"
		}), t.temperature && i.controls.push({
			kind: "slider",
			key: "color_temp_kelvin",
			label: "Colour temperature",
			min: t.minKelvin,
			max: t.maxKelvin,
			step: 50,
			value: W(r.color_temp_kelvin) ?? t.minKelvin,
			format: (e) => `${Math.round(e)} K`
		}), t.color && i.controls.push({
			kind: "color",
			key: "hs_color",
			label: "Colour",
			value: Array.isArray(r.hs_color) ? [r.hs_color[0], r.hs_color[1]] : be(Array.isArray(r.rgb_color) ? r.rgb_color : H(W(r.color_temp_kelvin) ?? 3e3))
		}), t.effects.length && i.controls.push({
			kind: "select",
			key: "effect",
			label: "Effect",
			options: t.effects,
			value: r.effect ?? ""
		});
	} else if (n === "cover") {
		let e = r.supported_features || 0, t = [
			[
				1,
				"open_cover",
				"Open"
			],
			[
				8,
				"stop_cover",
				"Stop"
			],
			[
				2,
				"close_cover",
				"Close"
			]
		].filter(([t]) => e & t);
		t.length && i.controls.push({
			kind: "buttons",
			buttons: t.map(([, e, t]) => ({
				service: e,
				label: t
			}))
		}), !(e & 4) && e & 1 && e & 2 && i.controls.push({ kind: "cover-toggle" }), e & 4 && i.controls.push({
			kind: "slider",
			key: "position",
			service: "set_cover_position",
			label: "Position",
			min: 0,
			max: 100,
			step: 1,
			value: W(r.current_position) ?? 0,
			format: (e) => `${Math.round(e)}%`
		});
	} else if (n === "lock") i.controls.push({
		kind: "buttons",
		buttons: [{
			service: "lock",
			label: "Lock"
		}, {
			service: "unlock",
			label: "Unlock"
		}]
	});
	else if (n === "climate") {
		W(r.temperature) !== void 0 && i.controls.push({
			kind: "stepper",
			key: "temperature",
			service: "set_temperature",
			label: "Target temperature",
			min: W(r.min_temp) ?? 7,
			max: W(r.max_temp) ?? 35,
			step: W(r.target_temp_step) ?? .5,
			value: r.temperature,
			unit: "°"
		}), Array.isArray(r.hvac_modes) && r.hvac_modes.length && i.controls.push({
			kind: "select",
			key: "hvac_mode",
			service: "set_hvac_mode",
			label: "Mode",
			options: r.hvac_modes,
			value: e.state,
			required: !0
		});
		for (let [e, t, n, a] of [
			[
				"fan_modes",
				"fan_mode",
				"set_fan_mode",
				"Fan mode"
			],
			[
				"swing_modes",
				"swing_mode",
				"set_swing_mode",
				"Swing mode"
			],
			[
				"swing_horizontal_modes",
				"swing_horizontal_mode",
				"set_swing_horizontal_mode",
				"Horizontal swing"
			],
			[
				"preset_modes",
				"preset_mode",
				"set_preset_mode",
				"Preset"
			]
		]) Array.isArray(r[e]) && r[e].length && i.controls.push({
			kind: "select",
			key: t,
			service: n,
			label: a,
			options: r[e],
			value: r[t] ?? "",
			required: !0
		});
	} else [
		"switch",
		"input_boolean",
		"fan",
		"automation"
	].includes(n) ? (i.controls.push({
		kind: "toggle",
		on: e.state === "on"
	}), n === "fan" && (r.supported_features || 0) & 1 && i.controls.push({
		kind: "slider",
		key: "percentage",
		service: "set_percentage",
		label: "Speed",
		min: 0,
		max: 100,
		step: W(r.percentage_step) ?? 1,
		value: W(r.percentage) ?? 0,
		format: (e) => `${Math.round(e)}%`
	})) : ["button", "input_button"].includes(n) ? i.controls.push({
		kind: "buttons",
		buttons: [{
			service: "press",
			label: "Press"
		}]
	}) : (n === "scene" || n === "script") && i.controls.push({
		kind: "buttons",
		buttons: [{
			service: "turn_on",
			label: n === "scene" ? "Activate" : "Run"
		}]
	});
	return i;
}
function Oe(e, t, n) {
	let { domain: r, id: i } = e;
	if (t.kind === "toggle") return [
		r === "light" || r === "switch" ? r : "homeassistant",
		n ? "turn_on" : "turn_off",
		{ entity_id: i }
	];
	if (t.kind === "buttons") return [
		r,
		n,
		{ entity_id: i }
	];
	if (t.kind === "slider" || t.kind === "stepper" || t.kind === "select") return r === "light" ? t.key === "brightness" && !(n > 0) ? [
		"light",
		"turn_off",
		{ entity_id: i }
	] : t.key === "effect" && !n ? [
		"light",
		"turn_on",
		{
			entity_id: i,
			effect: "None"
		}
	] : [
		"light",
		"turn_on",
		{
			entity_id: i,
			[t.key]: n
		}
	] : [
		r,
		t.service,
		{
			entity_id: i,
			[t.key]: n
		}
	];
	if (t.kind === "color") return [
		"light",
		"turn_on",
		{
			entity_id: i,
			hs_color: n
		}
	];
	throw Error("Unknown control");
}
// dashboard/more-info.mjs
var ke = "\ndialog.mi{--mi-bg:#1c1c1c;--mi-fg:#e1e1e1;--mi-muted:#9b9b9b;--mi-line:#ffffff1f;--mi-surface:#ffffff14;--mi-surface-2:#ffffff24;--mi-primary:#03a9f4;--mi-ink:#fff;--mi-accent:var(--mi-primary);--mi-accent-ink:#fff;\n box-sizing:border-box;width:min(520px,calc(100vw - 32px));max-height:min(92vh,880px);margin:auto;padding:0;overflow:hidden;border:0;border-radius:28px;background:var(--mi-bg);color:var(--mi-fg);font:400 14px/1.45 Roboto,system-ui,sans-serif;box-shadow:0 24px 64px #0009;animation:mi-in .22s cubic-bezier(.2,.8,.2,1)}\n@media (prefers-color-scheme:light){dialog.mi{--mi-bg:#fff;--mi-fg:#212121;--mi-muted:#727272;--mi-line:#0000001f;--mi-surface:#0000000d;--mi-surface-2:#0000001a;--mi-ink:#212121;box-shadow:0 24px 64px #0004}}\ndialog.mi::backdrop{background:#000a}\n@media (prefers-color-scheme:light){dialog.mi::backdrop{background:#0006}}\n@keyframes mi-in{from{opacity:0;transform:translateY(20px) scale(.98)}}\n@media (prefers-reduced-motion:reduce){dialog.mi{animation:none}.mi *{transition:none!important;animation:none!important}}\n@media (max-width:600px){dialog.mi{width:100vw;max-width:100vw;margin:auto 0 0;border-radius:28px 28px 0 0;max-height:94vh;animation-name:mi-up}@keyframes mi-up{from{transform:translateY(100%)}}}\n.mi-frame{display:flex;flex-direction:column;max-height:min(92vh,880px)}\n@media (max-width:600px){.mi-frame{max-height:94vh}}\n.mi-head{display:flex;align-items:center;gap:4px;padding:12px 16px 4px 12px;flex-shrink:0}\n.mi-head .mi-titles{flex:1;min-width:0;padding-left:4px}\n.mi-head h2{margin:0;font-weight:500;font-size:20px;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.mi-head p{margin:0;color:var(--mi-muted);font-size:13px}\n.mi-iconbtn{display:grid;place-items:center;flex-shrink:0;width:48px;height:48px;padding:0;border:0;border-radius:50%;background:transparent;color:inherit;cursor:pointer;transition:background .15s}\n.mi-iconbtn:hover{background:var(--mi-surface)}\n.mi svg{width:24px;height:24px;fill:currentColor;display:block}\n.mi-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:8px 24px 24px}\n.mi-center{display:flex;flex-direction:column;align-items:center;gap:20px}\n.mi button:focus-visible,.mi [role=slider]:focus-visible{outline:2px solid var(--mi-primary);outline-offset:3px}\n/* sliders */\n.mi-slider{position:relative;overflow:hidden;background:var(--mi-surface);touch-action:none;cursor:pointer;user-select:none;-webkit-user-select:none;transition:background .15s}\n.mi-slider:hover{background:var(--mi-surface-2)}\n.mi-slider .mi-fill{position:absolute;background:var(--mi-accent);opacity:.92;transition:background .3s}\n.mi-slider.mi-dragging .mi-fill{transition:none}\n.mi-slider.mi-v{width:132px;height:min(300px,38vh);min-height:200px;border-radius:28px}\n.mi-v .mi-fill{left:0;right:0;bottom:0}\n.mi-v .mi-readout{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;pointer-events:none;color:var(--mi-accent-ink);text-shadow:0 1px 2px #0004}\n.mi-v .mi-big{font:500 34px/1.1 Roboto,system-ui,sans-serif}\n.mi-v .mi-small{font-size:14px;opacity:.85}\n.mi-slider.mi-h{width:100%;height:48px;border-radius:14px}\n.mi-h .mi-fill{left:0;top:0;bottom:0}\n.mi-h.mi-track{background-image:var(--mi-gradient);background-color:transparent}\n.mi-h.mi-track .mi-fill{display:none}\n.mi-h .mi-thumb{position:absolute;top:8px;bottom:8px;width:6px;margin-left:-3px;border-radius:3px;background:#fff;box-shadow:0 0 0 1.5px #0004;pointer-events:none}\n.mi-field{width:100%;display:grid;gap:8px}\n.mi-field>.mi-label{display:flex;justify-content:space-between;font-weight:500}\n.mi-field output{color:var(--mi-muted);font-weight:400}\n/* round buttons */\n.mi-row{display:flex;justify-content:center;flex-wrap:wrap;gap:14px;width:100%}\n.mi-round{display:flex;flex-direction:column;align-items:center;gap:6px;border:0;background:none;padding:0;color:inherit;font:inherit;font-size:12px;cursor:pointer;min-width:64px}\n.mi-round .mi-disc{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:var(--mi-surface-2);transition:background .15s,color .15s}\n.mi-round:hover .mi-disc{background:color-mix(in srgb,var(--mi-surface-2) 70%,var(--mi-fg) 14%)}\n.mi-round[aria-pressed=true] .mi-disc{background:var(--mi-accent);color:var(--mi-accent-ink)}\n.mi-round:disabled{opacity:.4;cursor:default}\n.mi-round>span:last-child{color:var(--mi-muted)}\n.mi-round[aria-pressed=true]>span:last-child{color:var(--mi-fg)}\n/* panels & lists */\n.mi-panel{width:100%;display:grid;gap:18px;padding:16px;border-radius:20px;background:var(--mi-surface)}\n.mi-panel[hidden]{display:none}\n.mi-list{display:grid;gap:2px;margin:0;padding:0;list-style:none;max-height:220px;overflow:auto}\n.mi-list button{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:44px;padding:0 12px;border:0;border-radius:12px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}\n.mi-list button:hover{background:var(--mi-surface-2)}\n.mi-list button[aria-checked=true]{color:var(--mi-primary);font-weight:500}\n.mi-list button[aria-checked=true]::after{content:\"✓\"}\n/* big tall switch and lock */\n.mi-tall{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;width:132px;height:min(240px,32vh);min-height:170px;border:0;border-radius:28px;background:var(--mi-surface-2);color:var(--mi-muted);font:500 16px Roboto,system-ui,sans-serif;cursor:pointer;transition:background .2s,color .2s}\n.mi-tall svg{width:44px;height:44px}\n.mi-tall[aria-checked=true]{background:var(--mi-accent);color:var(--mi-accent-ink)}\n.mi-lock{display:grid;place-items:center;width:176px;height:176px;border:0;border-radius:50%;background:color-mix(in srgb,var(--mi-accent) 22%,transparent);color:var(--mi-accent);cursor:pointer;transition:background .2s,color .2s;box-shadow:inset 0 0 0 3px color-mix(in srgb,var(--mi-accent) 55%,transparent)}\n.mi-lock svg{width:72px;height:72px}\n.mi-lock:disabled{opacity:.5;cursor:default}\n/* cover: big state, then a tall two-way switch or a position slider */\n.mi-statehead{display:flex;flex-direction:column;align-items:center;gap:2px;margin:4px 0 4px;text-align:center}\n.mi-statehead strong{font:400 40px/1.15 Roboto,system-ui,sans-serif;letter-spacing:-.5px}\n.mi-statehead span{color:var(--mi-muted);font-size:16px}\n.mi-cover-switch{position:relative;box-sizing:border-box;width:132px;height:min(330px,40vh);min-height:220px;padding:8px;border:0;border-radius:32px;background:var(--mi-surface-2);color:inherit;cursor:pointer;touch-action:none}\n.mi-cover-switch:hover{background:color-mix(in srgb,var(--mi-surface-2) 70%,var(--mi-fg) 10%)}\n.mi-cover-knob{position:absolute;left:8px;right:8px;bottom:calc(8px + (50% - 8px) * var(--mi-pos,0));height:calc(50% - 8px);display:grid;place-items:center;border-radius:24px;background:#9e9e9e;color:#fff;pointer-events:none;transition:bottom .25s cubic-bezier(.3,.7,.3,1),background .25s}\n.mi-cover-switch.mi-dragging .mi-cover-knob{transition:background .25s}\n.mi-cover-switch[aria-checked=true] .mi-cover-knob{background:var(--mi-accent)}\n.mi-cover-switch[data-moving=true]{background:color-mix(in srgb,var(--mi-accent) 28%,var(--mi-surface-2))}\n.mi-cover-switch[data-moving=true] .mi-cover-knob{background:var(--mi-accent);animation:mi-moving 1.2s ease-in-out infinite}\n@keyframes mi-moving{50%{opacity:.7}}\n.mi-cover-knob svg{width:30px;height:30px}\n.mi-cover-switch:disabled{opacity:.5;cursor:default}\n.mi-cover-buttons{display:flex;gap:0;padding:4px;border-radius:24px;background:var(--mi-surface)}\n.mi-cover-buttons .mi-iconbtn{width:64px;height:48px;border-radius:20px}\n.mi-cover-buttons .mi-iconbtn:hover{background:var(--mi-surface-2)}\n.mi-state{font:500 20px Roboto,system-ui,sans-serif}\n.mi-sub{color:var(--mi-muted);margin-top:-12px}\n/* climate */\n.mi-temp{display:flex;align-items:center;justify-content:center;gap:20px;width:100%}\n.mi-temp output{display:flex;flex-direction:column;align-items:center;min-width:140px;font:500 56px/1 Roboto,system-ui,sans-serif}\n.mi-temp output small{margin-top:8px;font:400 14px Roboto,system-ui,sans-serif;color:var(--mi-muted)}\n.mi-temp .mi-iconbtn{width:56px;height:56px;background:var(--mi-surface-2)}\n.mi-temp .mi-iconbtn:hover{background:color-mix(in srgb,var(--mi-surface-2) 70%,var(--mi-fg) 14%)}\n.mi-pill{min-height:48px;padding:0 28px;border:0;border-radius:24px;background:var(--mi-primary);color:#fff;font:500 15px Roboto,system-ui,sans-serif;cursor:pointer}\n.mi-pill:hover{filter:brightness(1.08)}\n/* climate dial */\n.mi-climate{gap:12px}\n.mi-current{display:flex;flex-direction:column;align-items:center;gap:2px;color:var(--mi-muted)}\n.mi-current strong{color:var(--mi-fg);font:500 20px Roboto,system-ui,sans-serif}\n.mi-dial{position:relative;width:min(300px,100%);aspect-ratio:1;touch-action:none;cursor:pointer;user-select:none;-webkit-user-select:none;border-radius:50%}\n.mi-dial svg{width:100%;height:100%;overflow:visible}\n.mi-dial svg path{fill:none;stroke-width:20;stroke-linecap:round}\n.mi-arc-track{stroke:var(--mi-surface-2)}\n.mi-arc-fill{stroke:var(--mi-accent);transition:stroke .3s}\n.mi-cur{fill:var(--mi-muted)}\n.mi-handle{fill:#fff;stroke:var(--mi-bg);stroke-width:0;filter:drop-shadow(0 1px 3px #0006)}\n.mi-dial.mi-dragging .mi-handle{r:13}\n.mi-dial-text{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;pointer-events:none}\n.mi-dial-state{font:400 18px Roboto,system-ui,sans-serif}\n.mi-dial-value{display:flex;align-items:flex-start;font:400 72px/1 Roboto,system-ui,sans-serif;letter-spacing:-1px}\n.mi-sup{display:flex;flex-direction:column;align-items:flex-start;gap:2px;margin:6px 0 0 4px;font:400 22px/1 Roboto,system-ui,sans-serif;letter-spacing:0}\n.mi-dec{font-size:22px;color:var(--mi-fg)}\n.mi-dialbtns{display:flex;gap:36px;margin-top:-58px;position:relative}\n.mi-outline{display:grid;place-items:center;width:56px;height:56px;padding:0;border:1px solid var(--mi-muted);border-radius:50%;background:var(--mi-bg);color:var(--mi-fg);cursor:pointer}\n.mi-outline:hover{background:var(--mi-surface-2)}\n.mi-tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;margin-top:8px}\n.mi-tile{display:flex;align-items:center;gap:12px;min-height:64px;padding:8px 14px;border:0;border-radius:16px;background:var(--mi-surface);color:inherit;font:inherit;text-align:left;cursor:pointer;min-width:0}\n.mi-tile:hover{background:var(--mi-surface-2)}\n.mi-tile-icon svg{width:24px;height:24px}\n.mi-tile-text{display:flex;flex-direction:column;min-width:0}\n.mi-tile-label{color:var(--mi-muted);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.mi-tile-value{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n/* attributes */\n.mi-attrs{margin-top:24px;border-top:1px solid var(--mi-line);padding-top:4px}\n.mi-attrs summary{display:flex;align-items:center;justify-content:space-between;min-height:48px;font-weight:500;cursor:pointer;list-style:none}\n.mi-attrs summary::-webkit-details-marker{display:none}\n.mi-attrs summary svg{transition:transform .2s}\n.mi-attrs[open] summary svg{transform:rotate(180deg)}\n.mi-attrs dl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:8px 16px;margin:0 0 4px}\n.mi-attrs dt{color:var(--mi-muted)}\n.mi-attrs dd{margin:0;text-align:right;overflow-wrap:anywhere}\n.mi-error{margin:12px 0 0;color:#db4437;text-align:center}\n", G = (e) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${B[e]}"/></svg>`, K = (e) => `rgb(${e.join(",")})`, Ae = ([e, t, n]) => (.299 * e + .587 * t + .114 * n) / 255 > .62 ? "#1c1c1c" : "#fff", q = (e) => e && e[0].toUpperCase() + e.slice(1).replace(/_/g, " "), je = {
	heat: "#ff8100",
	cool: "#2b9af9",
	heat_cool: "#ffab00",
	auto: "#4caf50",
	dry: "#efbd07",
	fan_only: "#8a8a8a"
};
function J(e, t, n, r) {
	let i = e.createElement(t);
	return n && (i.className = n), r !== void 0 && (i.innerHTML = r), i;
}
function Y(e, t) {
	let n = t.orient === "v", r = J(e, "div", `mi-slider ${n ? "mi-v" : "mi-h"}`), i = J(e, "div", "mi-fill");
	r.append(i);
	let a, o;
	n && (a = J(e, "div", "mi-readout", "<span class=\"mi-big\"></span><span class=\"mi-small\"></span>"), r.append(a)), t.gradient && (r.classList.add("mi-track"), r.style.setProperty("--mi-gradient", t.gradient)), n || (o = J(e, "div", "mi-thumb"), r.append(o)), r.setAttribute("role", "slider"), r.tabIndex = 0, r.setAttribute("aria-label", t.label), r.setAttribute("aria-orientation", n ? "vertical" : "horizontal"), r.setAttribute("aria-valuemin", t.min), r.setAttribute("aria-valuemax", t.max);
	let s = t.value ?? t.min, c = !1, l = t.max - t.min, u = () => {
		let e = Math.min(1, Math.max(0, (s - t.min) / l)) * 100;
		n ? i.style.height = `${e}%` : (i.style.width = `${e}%`, o.style.left = `${e}%`), r.setAttribute("aria-valuenow", s), r.setAttribute("aria-valuetext", t.format ? t.format(s) : s), a && (a.querySelector(".mi-big").textContent = t.format ? t.format(s) : s);
	}, d = (e) => {
		let n = t.step || 1;
		return Math.min(t.max, Math.max(t.min, Math.round((e - t.min) / n) * n + t.min));
	}, f = (e) => {
		let i = r.getBoundingClientRect(), a = n ? 1 - (e.clientY - i.top) / i.height : (e.clientX - i.left) / i.width;
		return d(t.min + Math.min(1, Math.max(0, a)) * l);
	}, p = (e) => {
		s = e, u(), t.onInput?.(s);
	};
	r.addEventListener("pointerdown", (e) => {
		e.button === 0 && (c = !0, r.classList.add("mi-dragging"), r.setPointerCapture(e.pointerId), p(f(e)));
	}), r.addEventListener("pointermove", (e) => {
		c && p(f(e));
	});
	let m = () => {
		c && (c = !1, r.classList.remove("mi-dragging"), t.onCommit?.(s));
	};
	r.addEventListener("pointerup", m), r.addEventListener("pointercancel", m);
	let h;
	return r.addEventListener("keydown", (e) => {
		let n = e.shiftKey ? 10 : 1, r = {
			ArrowRight: 1,
			ArrowUp: 1,
			ArrowLeft: -1,
			ArrowDown: -1,
			PageUp: 10,
			PageDown: -10
		}[e.key], i;
		if (r !== void 0) i = s + r * n * (t.step || 1);
		else if (e.key === "Home") i = t.min;
		else if (e.key === "End") i = t.max;
		else return;
		e.preventDefault(), p(d(i)), clearTimeout(h), h = setTimeout(() => t.onCommit?.(s), 350);
	}), u(), {
		el: r,
		caption(e) {
			let t = a?.querySelector(".mi-small");
			t && (t.textContent = e);
		},
		set(e) {
			c || e === s || (s = e, u());
		},
		get dragging() {
			return c;
		}
	};
}
function X(e, t, n, r, i) {
	let a = J(e, "button", "mi-round", `<span class="mi-disc">${G(t)}</span><span>${n}</span>`);
	return a.type = "button", i !== void 0 && a.setAttribute("aria-pressed", String(i)), a.onclick = r, a;
}
function Me({ host: e, getHass: t, entityId: n, onError: r = () => {} }) {
	let i = e.ownerDocument, a = J(i, "dialog", "mi");
	a.setAttribute("aria-labelledby", "mi-title");
	let o = J(i, "div", "mi-frame"), s = J(i, "div", "mi-head"), c = J(i, "button", "mi-iconbtn", G("close"));
	c.type = "button", c.setAttribute("aria-label", "Close");
	let l = J(i, "div", "mi-titles"), u = J(i, "h2");
	u.id = "mi-title";
	let d = J(i, "p");
	l.append(u, d), s.append(c, l);
	let f = J(i, "div", "mi-body"), p = J(i, "style");
	p.textContent = ke, o.append(s, f), a.append(p, o), e.append(a);
	let m = "", h, g = (e) => {
		h ||= f.appendChild(J(i, "p", "mi-error")), h.textContent = e || "", h.hidden = !e;
	}, _ = async (e, n, i) => {
		try {
			g("");
			let [r, a, o] = Oe(e, n, i);
			return await t().callService(r, a, o), !0;
		} catch (e) {
			return g(e?.message || "The command failed."), r(e), !1;
		}
	}, v = (e, t) => e.controls.find(t);
	function y(e, t) {
		let n = v(e, (e) => e.kind === "toggle"), r = v(e, (e) => e.key === "brightness"), o = v(e, (e) => e.key === "color_temp_kelvin"), s = v(e, (e) => e.kind === "color"), c = v(e, (e) => e.key === "effect"), l = J(i, "div", "mi-center"), u;
		r ? (u = Y(i, {
			orient: "v",
			label: "Brightness",
			min: r.min,
			max: r.max,
			step: r.step,
			value: r.value,
			format: r.format,
			onCommit: (t) => _(e, r, t)
		}), l.append(u.el)) : (u = J(i, "button", "mi-tall", `${G("bulb")}<span></span>`), u.type = "button", u.setAttribute("role", "switch"), u.onclick = () => _(e, n, u.getAttribute("aria-checked") !== "true"), l.append(u));
		let d = J(i, "div", "mi-row"), f = X(i, "power", "Power", () => {
			let t = f.getAttribute("aria-pressed") === "true";
			_(e, n, !t);
		}, !1);
		d.append(f);
		let p = {}, m = {}, h = (e) => {
			for (let t of Object.keys(p)) {
				let n = t === e && p[t].hidden;
				p[t].hidden = !n, m[t].setAttribute("aria-pressed", String(n));
			}
		}, g = (e, t, n, r) => {
			m[e] = X(i, t, n, () => h(e), !1), p[e] = r, r.hidden = !0, d.append(m[e]);
		}, y = [];
		if (o) {
			let t = J(i, "output"), n = J(i, "div", "mi-field"), r = J(i, "div", "mi-label", "<span>Colour temperature</span>");
			r.append(t);
			let a = Y(i, {
				orient: "h",
				label: "Colour temperature",
				min: o.min,
				max: o.max,
				step: 50,
				value: o.value,
				gradient: "linear-gradient(90deg,#ffa93d,#ffe3b8 40%,#f4f6ff 65%,#a8c8ff)",
				format: (e) => `${Math.round(e)} K`,
				onInput: (e) => t.textContent = `${Math.round(e)} K`,
				onCommit: (t) => _(e, o, t)
			});
			n.append(r, a.el);
			let s = J(i, "div", "mi-panel");
			s.append(n), g("temp", "thermo", "Temperature", s), y.push((e) => {
				let n = v(e, (e) => e.key === "color_temp_kelvin");
				n && (a.set(n.value), t.textContent = `${Math.round(n.value)} K`);
			});
		}
		if (s) {
			let t = J(i, "output"), n = J(i, "output"), r = s.value[0], a = s.value[1], o = () => `linear-gradient(90deg,#fff,${K(xe([r, 100]))})`, c = Y(i, {
				orient: "h",
				label: "Hue",
				min: 0,
				max: 360,
				step: 1,
				value: r,
				gradient: "linear-gradient(90deg,#f00,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00)",
				onInput: (e) => {
					r = e, t.textContent = `${e}°`, l.el.style.setProperty("--mi-gradient", o());
				},
				onCommit: () => _(e, s, [r, a])
			}), l = Y(i, {
				orient: "h",
				label: "Saturation",
				min: 0,
				max: 100,
				step: 1,
				value: a,
				gradient: o(),
				onInput: (e) => {
					a = e, n.textContent = `${e}%`;
				},
				onCommit: () => _(e, s, [r, a])
			}), u = J(i, "div", "mi-field"), d = J(i, "div", "mi-field"), f = J(i, "div", "mi-label", "<span>Hue</span>"), p = J(i, "div", "mi-label", "<span>Saturation</span>");
			f.append(t), p.append(n), u.append(f, c.el), d.append(p, l.el), t.textContent = `${r}°`, n.textContent = `${a}%`;
			let m = J(i, "div", "mi-panel");
			m.append(u, d), g("color", "palette", "Colour", m), y.push((e) => {
				let i = v(e, (e) => e.kind === "color");
				!i || c.dragging || l.dragging || ([r, a] = i.value, c.set(r), l.set(a), t.textContent = `${r}°`, n.textContent = `${a}%`, l.el.style.setProperty("--mi-gradient", o()));
			});
		}
		let b = [];
		if (c) {
			let t = J(i, "ul", "mi-list");
			t.setAttribute("role", "radiogroup");
			for (let n of ["", ...c.options]) {
				let r = J(i, "li"), a = J(i, "button");
				a.type = "button", a.setAttribute("role", "radio"), a.textContent = n || "None", a.dataset.value = n, a.onclick = () => _(e, c, n), r.append(a), t.append(r), b.push(a);
			}
			let n = J(i, "div", "mi-panel");
			n.append(t), g("effect", "effects", "Effect", n), y.push((e) => {
				let t = v(e, (e) => e.key === "effect");
				for (let e of b) e.setAttribute("aria-checked", String(e.dataset.value === (t?.value || "")));
			});
		}
		return l.append(d, ...Object.values(p)), t.append(l), (e, t) => {
			let n = e.state === "on", i = t?.attributes || {}, o = Array.isArray(i.rgb_color) ? i.rgb_color : i.color_temp_kelvin ? H(i.color_temp_kelvin) : [
				255,
				193,
				7
			];
			if (a.style.setProperty("--mi-accent", K(o)), a.style.setProperty("--mi-accent-ink", n ? Ae(o) : "var(--mi-fg)"), f.setAttribute("aria-pressed", String(n)), v(e, (e) => e.kind === "toggle"), r) {
				let t = v(e, (e) => e.key === "brightness");
				u.set(n ? t?.value ?? 0 : 0), u.el.querySelector(".mi-big").textContent = n ? r.format(t?.value ?? 0) : "Off", u.caption(n ? "On" : "");
			} else u.setAttribute("aria-checked", String(n)), u.querySelector("span").textContent = n ? "On" : "Off";
			for (let t of y) t(e);
		};
	}
	function b(e, r) {
		let o = v(e, (e) => e.key === "position"), s = v(e, (e) => e.kind === "buttons"), c = !!v(e, (e) => e.kind === "cover-toggle"), l = J(i, "div", "mi-center"), u = J(i, "div", "mi-statehead", "<strong></strong><span></span>");
		l.append(u), d.hidden = !0;
		let f, p, m = null, h, g = null, y = (e) => p?.style.setProperty("--mi-pos", String(e));
		if (c) {
			p = J(i, "button", "mi-cover-switch", "<span class=\"mi-cover-knob\"></span>"), p.type = "button", p.setAttribute("role", "switch"), p.setAttribute("aria-label", e.name);
			let r = () => p.getAttribute("aria-checked") === "true", a = async (r) => {
				let i = t().states?.[n], a = ["open", "closed"].includes(i?.state);
				m = r, clearTimeout(h), a && i.state === "open" === r ? m = null : h = setTimeout(() => {
					m = null, k();
				}, 6e4), k(), m !== null && (await _(e, s, r ? "open_cover" : "close_cover") || (m = null, k()));
			};
			p.addEventListener("pointerdown", (e) => {
				if (!(e.button !== 0 || p.disabled)) {
					g = {
						id: e.pointerId,
						y: e.clientY,
						from: +!!r(),
						pos: +!!r(),
						dragging: !1
					};
					try {
						p.setPointerCapture(e.pointerId);
					} catch {}
				}
			}), p.addEventListener("pointermove", (e) => {
				if (!g || e.pointerId !== g.id) return;
				let t = g.y - e.clientY;
				if (!g.dragging && Math.abs(t) < 6) return;
				g.dragging = !0, p.classList.add("mi-dragging");
				let n = Math.max(1, p.clientHeight / 2 - 8);
				g.pos = Math.min(1, Math.max(0, g.from + t / n)), y(g.pos);
			});
			let o = (e) => {
				if (!g || e.pointerId !== g.id) return;
				let { dragging: t, pos: n, from: i } = g;
				g = null, p.classList.remove("mi-dragging"), e.type === "pointercancel" ? y(i) : a(t ? n >= .5 : !r());
			};
			p.addEventListener("pointerup", o), p.addEventListener("pointercancel", o), p.onclick = (e) => {
				e.detail === 0 && a(!r());
			}, p.onkeydown = (e) => {
				(e.key === "ArrowUp" || e.key === "ArrowDown") && (e.preventDefault(), a(e.key === "ArrowUp"));
			}, l.append(p);
		}
		o && (f = Y(i, {
			orient: "v",
			label: "Position",
			min: 0,
			max: 100,
			step: 1,
			value: o.value,
			format: (e) => `${Math.round(e)}%`,
			onCommit: (t) => _(e, o, t)
		}), l.append(f.el));
		let b = J(i, "div", "mi-row"), x = {
			open_cover: "up",
			stop_cover: "stop",
			close_cover: "down"
		}, S = {
			open_cover: "Open",
			stop_cover: "Stop",
			close_cover: "Close"
		};
		if (!c) {
			b.className = "mi-cover-buttons";
			for (let t of s?.buttons || []) {
				let n = J(i, "button", "mi-iconbtn", G(x[t.service]));
				n.type = "button", n.title = S[t.service], n.setAttribute("aria-label", S[t.service]), n.onclick = () => _(e, s, t.service), b.append(n);
			}
			l.append(b);
		}
		r.append(l);
		let C = setInterval(() => {
			if (!a.isConnected) return clearInterval(C);
			let e = t().states?.[n];
			u.lastChild.textContent = U(e?.last_changed);
		}, 5e3);
		return (e, t) => {
			if (a.style.setProperty("--mi-accent", "#9c27b0"), u.firstChild.textContent = e.unavailable ? "Unavailable" : q(e.state), u.lastChild.textContent = e.since, p) {
				let t = ["open", "opening"].includes(e.state), n = ["opening", "closing"].includes(e.state);
				m !== null && (!n && t === m ? (m = null, clearTimeout(h)) : (n || (u.firstChild.textContent = m ? "Opening" : "Closing"), t = m, n = !0)), p.setAttribute("aria-checked", String(t)), g?.dragging || y(+!!t), p.dataset.moving = String(n), p.firstChild.innerHTML = G(Ce(e.deviceClass, t));
			}
			let n = v(e, (e) => e.key === "position");
			f && n && (f.set(n.value), f.caption(q(e.state)));
		};
	}
	function x(e, t) {
		let n = v(e, (e) => e.kind === "buttons"), r = J(i, "div", "mi-center"), o = J(i, "button", "mi-lock");
		o.type = "button";
		let s = J(i, "div", "mi-state");
		return o.onclick = () => _(e, n, o.dataset.locked === "true" ? "unlock" : "lock"), r.append(o, s), t.append(r), (e) => {
			let t = e.state === "locked", n = [
				"locking",
				"unlocking",
				"opening"
			].includes(e.state), r = e.state === "jammed" || e.state === "unlocked" ? "#e5533d" : n ? "#ff9800" : "#43a047";
			a.style.setProperty("--mi-accent", r), o.dataset.locked = String(t), o.disabled = n, o.innerHTML = G(t ? "lock" : "unlock"), o.setAttribute("aria-label", t ? "Locked. Press to unlock" : "Unlocked. Press to lock"), s.textContent = q(e.state);
		};
	}
	function S(e, n) {
		let r = v(e, (e) => e.kind === "stepper"), o = e.controls.filter((e) => e.kind === "select"), s = J(i, "div", "mi-center mi-climate"), c = () => t().config?.unit_system?.temperature || "°C", l = J(i, "div", "mi-current");
		s.append(l);
		let u, d;
		if (r) {
			let t = (e) => {
				let t = e * Math.PI / 180;
				return [110 + 92 * Math.cos(t), 110 + 92 * Math.sin(t)];
			}, n = (e, n) => {
				if (n - e < .5) return "";
				let [r, i] = t(e), [a, o] = t(n);
				return `M${r.toFixed(2)} ${i.toFixed(2)}A92 92 0 ${+(n - e > 180)} 1 ${a.toFixed(2)} ${o.toFixed(2)}`;
			};
			u = J(i, "div", "mi-dial", `<svg viewBox="0 0 220 220" aria-hidden="true"><path class="mi-arc-track" d="${n(135, 405)}"/><path class="mi-arc-fill"/><circle class="mi-cur" r="3.5"/><circle class="mi-handle" r="11"/></svg><div class="mi-dial-text"><span class="mi-dial-state"></span><span class="mi-dial-value"><span class="mi-int"></span><span class="mi-sup"><span class="mi-unit"></span><span class="mi-dec"></span></span></span></div>`), u.setAttribute("role", "slider"), u.tabIndex = 0, u.setAttribute("aria-label", "Target temperature"), u.setAttribute("aria-valuemin", r.min), u.setAttribute("aria-valuemax", r.max);
			let a = u.querySelector(".mi-arc-fill"), o = u.querySelector(".mi-handle"), l = u.querySelector(".mi-cur"), f = r.max - r.min, p = (e) => 135 + Math.min(1, Math.max(0, (e - r.min) / f)) * 270, m = r.value, h = !1, g = e.state, y, b = (e) => {
				let t = Math.round((e - r.min) / r.step) * r.step;
				return Math.min(r.max, Math.max(r.min, Math.round((r.min + t) * 100) / 100));
			}, x = () => {
				let e = p(m);
				a.setAttribute("d", g === "off" ? "" : g === "cool" ? n(e, 405) : n(135, e));
				let [i, s] = t(e);
				if (o.setAttribute("cx", i), o.setAttribute("cy", s), Number.isFinite(y)) {
					let [e, n] = t(p(y));
					l.setAttribute("cx", e), l.setAttribute("cy", n), l.removeAttribute("hidden");
				} else l.setAttribute("hidden", "");
				let d = r.step < 1;
				u.querySelector(".mi-int").textContent = Math.trunc(m), u.querySelector(".mi-unit").textContent = c(), u.querySelector(".mi-dec").textContent = d ? (m % 1).toFixed(1).slice(1) : "", u.setAttribute("aria-valuenow", m), u.setAttribute("aria-valuetext", `${m} ${c()}`);
			}, S = (e) => {
				let t = u.querySelector("svg").getBoundingClientRect(), n = e.clientX - (t.left + t.width / 2), i = e.clientY - (t.top + t.height / 2), a = (Math.atan2(i, n) * 180 / Math.PI - 135 + 720) % 360;
				return a > 270 && (a = a > 315 ? 0 : 270), b(r.min + a / 270 * f);
			}, C = (e) => {
				m = e, x();
			};
			u.addEventListener("pointerdown", (e) => {
				e.button === 0 && (h = !0, u.classList.add("mi-dragging"), u.setPointerCapture(e.pointerId), C(S(e)));
			}), u.addEventListener("pointermove", (e) => {
				h && C(S(e));
			});
			let w, T = () => {
				clearTimeout(w), w = setTimeout(() => _(e, r, m), 500);
			}, E = () => {
				h && (h = !1, u.classList.remove("mi-dragging"), _(e, r, m));
			};
			u.addEventListener("pointerup", E), u.addEventListener("pointercancel", E), u.addEventListener("keydown", (e) => {
				let t = {
					ArrowRight: 1,
					ArrowUp: 1,
					ArrowLeft: -1,
					ArrowDown: -1
				}[e.key];
				t !== void 0 && (e.preventDefault(), C(b(m + t * r.step)), T());
			});
			let D = J(i, "div", "mi-dialbtns");
			for (let [e, t, n] of [[
				-1,
				"minus",
				"Lower target temperature"
			], [
				1,
				"plus",
				"Raise target temperature"
			]]) {
				let a = J(i, "button", "mi-outline", G(t));
				a.type = "button", a.setAttribute("aria-label", n), a.onclick = () => {
					C(b(m + e * r.step)), T();
				}, D.append(a);
			}
			s.append(u, D), d = (e, t) => {
				let n = v(e, (e) => e.kind === "stepper");
				g = e.state, y = t?.attributes?.current_temperature, n && !h && (m = n.value);
				let r = t?.attributes?.hvac_action;
				u.querySelector(".mi-dial-state").textContent = e.state === "off" ? "Off" : q(r || e.state), x();
			};
		}
		let f = {
			hvac_mode: null,
			fan_mode: "fan_only",
			swing_mode: "swing",
			swing_horizontal_mode: "swingh",
			preset_mode: "preset"
		}, p = J(i, "div", "mi-tiles"), m = J(i, "div", "mi-panel");
		m.hidden = !0;
		let h = J(i, "ul", "mi-list");
		h.setAttribute("role", "radiogroup"), m.append(h);
		let g, y = /* @__PURE__ */ new Map(), b = (t) => {
			if (g === t.key) g = void 0, m.hidden = !0;
			else {
				g = t.key, h.replaceChildren();
				for (let n of t.options) {
					let r = J(i, "li"), a = J(i, "button");
					a.type = "button", a.setAttribute("role", "radio"), a.dataset.value = n, a.textContent = q(n), a.onclick = () => {
						_(e, t, n), g = void 0, m.hidden = !0;
					}, r.append(a), h.append(r);
				}
				m.hidden = !1, S(x);
			}
		}, x, S = (e) => {
			let t = e && v(e, (e) => e.key === g);
			for (let e of h.querySelectorAll("button")) e.setAttribute("aria-checked", String(e.dataset.value === t?.value));
		};
		for (let e of o) {
			let t = J(i, "button", "mi-tile", "<span class=\"mi-tile-icon\"></span><span class=\"mi-tile-text\"><span class=\"mi-tile-label\"></span><span class=\"mi-tile-value\"></span></span>");
			t.type = "button", t.querySelector(".mi-tile-label").textContent = e.label, t.onclick = () => b(e), p.append(t), y.set(e.key, t);
		}
		return o.length && s.append(p, m), n.append(s), (e, t) => {
			x = e;
			let n = t?.attributes || {};
			a.style.setProperty("--mi-accent", je[e.state] || "var(--mi-muted)"), l.hidden = !Number.isFinite(n.current_temperature), l.innerHTML = `<span>Current temperature</span><strong>${n.current_temperature} ${c()}</strong>`, d?.(e, t);
			for (let t of e.controls.filter((e) => e.kind === "select")) {
				let e = y.get(t.key);
				if (!e) continue;
				e.querySelector(".mi-tile-value").textContent = q(t.value) || "—";
				let n = t.key === "hvac_mode" ? B[t.value] ? t.value : "power" : f[t.key];
				e.querySelector(".mi-tile-icon").innerHTML = G(n);
			}
			S(e);
		};
	}
	function C(e, t) {
		let n = v(e, (e) => e.kind === "toggle"), r = v(e, (e) => e.key === "percentage"), o = J(i, "div", "mi-center"), s = J(i, "button", "mi-tall", `${G("power")}<span></span>`);
		s.type = "button", s.setAttribute("role", "switch"), s.onclick = () => _(e, n, s.getAttribute("aria-checked") !== "true"), o.append(s);
		let c;
		if (r) {
			let t = J(i, "output"), n = J(i, "div", "mi-field"), a = J(i, "div", "mi-label", "<span>Speed</span>");
			a.append(t), c = Y(i, {
				orient: "h",
				label: "Speed",
				min: 0,
				max: 100,
				step: r.step,
				value: r.value,
				format: (e) => `${Math.round(e)}%`,
				onInput: (e) => t.textContent = `${Math.round(e)}%`,
				onCommit: (t) => _(e, r, t)
			}), n.append(a, c.el), o.append(n);
		}
		return t.append(o), (e) => {
			let t = e.state === "on";
			a.style.setProperty("--mi-accent", "var(--mi-primary)"), s.setAttribute("aria-checked", String(t)), s.querySelector("span").textContent = t ? "On" : "Off";
			let n = v(e, (e) => e.key === "percentage");
			c && n && c.set(n.value);
		};
	}
	function w(e, t) {
		let n = v(e, (e) => e.kind === "buttons"), r = J(i, "div", "mi-center");
		for (let t of n.buttons) {
			let a = J(i, "button", "mi-pill", t.label);
			a.type = "button", a.onclick = () => _(e, n, t.service), r.append(a);
		}
		return t.append(r), () => {};
	}
	function T(e, t, n) {
		let r = J(i, "div", "mi-center"), a = J(i, "div", "mi-state");
		return r.append(a), t.append(r), (e, t) => {
			let n = t?.attributes?.unit_of_measurement;
			a.textContent = `${q(e.state) ?? ""}${n ? ` ${n}` : ""}`;
		};
	}
	let E = {
		light: y,
		cover: b,
		lock: x,
		climate: S,
		switch: C,
		input_boolean: C,
		fan: C,
		automation: C,
		button: w,
		input_button: w,
		scene: w,
		script: w
	}, D = () => {};
	function O(e) {
		f.replaceChildren(), h = void 0;
		let t = J(i, "div");
		if (f.append(t), d.hidden = !1, D = (e.unavailable ? T : E[e.domain] || T)(e, t), e.attributes.length) {
			let t = J(i, "details", "mi-attrs", `<summary><span>Attributes</span>${G("chevron")}</summary>`), n = J(i, "dl");
			for (let [t, r] of e.attributes) n.append(J(i, "dt"), J(i, "dd")), n.lastChild.previousSibling.textContent = t, n.lastChild.textContent = r;
			t.append(n), f.append(t);
		}
	}
	function k() {
		let e = t().states?.[n], r = De(e);
		u.textContent = r.name, d.textContent = r.unavailable ? "Unavailable" : [q(r.state), r.changed && `changed ${r.changed}`].filter(Boolean).join(" · ");
		let i = [
			r.unavailable,
			r.domain,
			...r.controls.map((e) => `${e.kind}:${e.key || ""}:${(e.options || []).join(",")}:${(e.buttons || []).length}`)
		].join("|");
		i !== m && (m = i, O(r)), D(r, e);
	}
	let A = () => {
		a.open && a.close();
	};
	return c.onclick = A, a.addEventListener("click", (e) => {
		e.target === a && A();
	}), a.addEventListener("close", () => a.remove()), k(), a.showModal(), {
		update: k,
		close: A,
		dialog: a
	};
}
// dashboard/standalone-fit.mjs
function Z({ standalone: e, innerWidth: t, innerHeight: n, screenWidth: r, screenHeight: i, insetTop: a }) {
	if (!e || !(a > 0)) return n;
	let o = n >= t ? Math.max(r, i) : Math.min(r, i);
	return Math.abs(n + a - o) <= 2 ? n + a : n;
}
function Ne(e = window) {
	let t = e.document, n = t.createElement("div");
	n.style.cssText = "position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none", t.documentElement.append(n);
	let r = () => {
		let r = Z({
			standalone: e.navigator.standalone === !0 || e.matchMedia?.("(display-mode: standalone)").matches === !0,
			innerWidth: e.innerWidth,
			innerHeight: e.innerHeight,
			screenWidth: e.screen.width,
			screenHeight: e.screen.height,
			insetTop: n.getBoundingClientRect().height
		});
		t.documentElement.style.setProperty("--three-d-rooms-page-height", `${Math.round(r)}px`);
	};
	return r(), e.addEventListener("resize", r), e.addEventListener("orientationchange", () => setTimeout(r, 250)), e.visualViewport?.addEventListener("resize", r), r;
}
// dashboard/standalone.js
Ne();
var Q = document.getElementById("status"), $ = (e) => {
	Q.hidden = !1, Q.textContent = e;
};
async function Pe() {
	let e = document.body.dataset.view;
	await customElements.whenDefined("three-d-rooms-card");
	let t = await j({
		hassUrl: location.origin,
		...pe(localStorage)
	}), n = new URL(location.href);
	for (let e of [
		"auth_callback",
		"code",
		"state"
	]) n.searchParams.delete(e);
	history.replaceState(null, "", n);
	let r = await de({ auth: t }), i = await r.sendMessagePromise({ type: "auth/current_user" });
	if (!i.is_admin) {
		$("3D Rooms views are only available to Home Assistant administrators.");
		return;
	}
	let a = async () => {
		let e = new Set(JSON.parse(document.body.dataset.modules || "[]"));
		try {
			let t = await r.sendMessagePromise({ type: "lovelace/resources" });
			for (let n of t) n.type === "module" && e.add(n.url);
		} catch {}
		await Promise.allSettled([...e].filter((e) => !e.includes("/three_d_rooms_static/")).map((e) => import(
			/* @vite-ignore */
			new URL(e, location.origin).href
)));
	}, o = await r.sendMessagePromise({ type: "config/entity_registry/list_for_display" }).catch(() => null);
	ve({
		resolver: ge({ loadModules: a }),
		registryIcon: _e(o)
	});
	let s = await ne(r).catch(() => ({})), c = document.createElement("three-d-rooms-card");
	c.setConfig({
		saved_view: e,
		height: "auto",
		edit_button: !1
	}), c.setAttribute("fill-page", "");
	let l = fe({
		auth: t,
		connection: r,
		user: i,
		config: s,
		origin: location.origin,
		onChange: (e) => {
			c.hass = e, u?.update();
		}
	}), u;
	c.addEventListener("hass-more-info", (e) => {
		u?.close(), u = Me({
			host: document.body,
			getHass: () => l.build(),
			entityId: e.detail.entityId,
			onError: (e) => console.error(e)
		});
	}), r.addEventListener("ready", () => l.setConnected(!0)), r.addEventListener("disconnected", () => l.setConnected(!1)), await new Promise((e) => ue(r, (t) => {
		l.setStates(t), e();
	})), c.hass = l.build(), Q.hidden = !0, document.body.append(c);
}
Pe().catch((e) => {
	console.error(e), $(e?.message || "Could not connect to Home Assistant. Reload to try again.");
});
