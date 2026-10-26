/* Usage counts (GoatCounter, no cookies, no personal data). tgEvent(name) counts one button press; it does nothing when the
   counter is blocked or hasn't loaded, so a page never depends on it. Only the event's name is sent, never anything the visitor
   chose, loaded or painted. */
function tgEvent(name) {
  try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "event/" + name, title: name, event: true }); } catch (e) { /* counting is optional */ }
}
