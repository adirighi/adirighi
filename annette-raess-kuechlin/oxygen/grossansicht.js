// Großansicht für die Werke. Klick auf ein Bild öffnet es groß, mit Titel, Jahr und Blättern.
(function () {
  if (window.arkdLightbox) return;
  window.arkdLightbox = true;

  function text(el) {
    return el ? el.textContent.trim() : '';
  }

  function init() {
    var frames = Array.prototype.slice.call(document.querySelectorAll('.arkd-work-frame'));
    var probe = document.createElement('dialog');
    if (!frames.length || typeof probe.showModal !== 'function') return;

    var dialog = document.createElement('dialog');
    dialog.className = 'arkd-lb';
    dialog.setAttribute('aria-label', 'Werkansicht');
    dialog.innerHTML =
      '<button type="button" class="arkd-lb-btn arkd-lb-close" data-a="close">Schließen</button>' +
      '<figure class="arkd-lb-figure"><img class="arkd-lb-img" alt=""><figcaption class="arkd-lb-caption"></figcaption></figure>' +
      '<div class="arkd-lb-bar">' +
      '<button type="button" class="arkd-lb-btn" data-a="prev" aria-label="Vorheriges Werk">Zurück</button>' +
      '<span class="arkd-lb-count" aria-live="polite"></span>' +
      '<button type="button" class="arkd-lb-btn" data-a="next" aria-label="Nächstes Werk">Weiter</button>' +
      '</div>';
    document.body.appendChild(dialog);

    var big = dialog.querySelector('.arkd-lb-img');
    var caption = dialog.querySelector('.arkd-lb-caption');
    var count = dialog.querySelector('.arkd-lb-count');
    var current = 0;

    function show(index) {
      current = (index + frames.length) % frames.length;
      var frame = frames[current];
      var img = frame.querySelector('img');
      var work = frame.parentElement;
      big.src = img.getAttribute('src');
      big.alt = img.alt;
      var parts = [text(work.querySelector('.arkd-work-title')), text(work.querySelector('.arkd-work-year'))].filter(Boolean);
      caption.textContent = parts.join(', ');
      count.textContent = (current + 1) + ' / ' + frames.length;
    }

    frames.forEach(function (frame, index) {
      frame.setAttribute('tabindex', '0');
      frame.setAttribute('role', 'button');
      frame.setAttribute('aria-label', 'Werk ' + (index + 1) + ' groß ansehen');
      function open() {
        show(index);
        dialog.showModal();
      }
      frame.addEventListener('click', open);
      frame.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
    });

    dialog.addEventListener('click', function (event) {
      var action = event.target.getAttribute && event.target.getAttribute('data-a');
      if (action === 'prev') show(current - 1);
      else if (action === 'next') show(current + 1);
      else if (action === 'close' || event.target === dialog || event.target === big) dialog.close();
    });

    dialog.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') show(current - 1);
      if (event.key === 'ArrowRight') show(current + 1);
    });

    dialog.addEventListener('close', function () {
      frames[current].focus();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
