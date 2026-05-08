// 브라우저 자동완성 전역 차단
document.addEventListener('DOMContentLoaded', function() {
  function disableAutofill(root) {
    root.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="date"]):not([type="time"]):not([type="color"]):not([type="range"]), textarea').forEach(function(el) {
      if (!el.getAttribute('autocomplete') || el.getAttribute('autocomplete') === 'on') {
        el.setAttribute('autocomplete', 'off');
      }
    });
  }
  disableAutofill(document);
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (node.nodeType === 1) disableAutofill(node);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
});
