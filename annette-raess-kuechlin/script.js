// Bildansicht für die Arbeiten. Ohne JavaScript bleibt die Seite vollständig lesbar.
(function () {
  var year = document.getElementById('jahr');
  if (year) year.textContent = new Date().getFullYear();

  var dialog = document.getElementById('lightbox');
  var image = document.getElementById('lightbox-img');
  var count = document.getElementById('lightbox-count');
  var buttons = Array.prototype.slice.call(document.querySelectorAll('.works button'));
  if (!dialog || !dialog.showModal || !buttons.length) return;

  var current = 0;

  function show(index) {
    current = (index + buttons.length) % buttons.length;
    var thumb = buttons[current].querySelector('img');
    image.src = buttons[current].dataset.full;
    image.alt = thumb.alt;
    count.textContent = (current + 1) + ' / ' + buttons.length;
  }

  buttons.forEach(function (button, index) {
    button.setAttribute('aria-label', 'Arbeit ' + (index + 1) + ' groß ansehen');
    button.addEventListener('click', function () {
      show(index);
      dialog.showModal();
    });
  });

  dialog.addEventListener('click', function (event) {
    var action = event.target.dataset && event.target.dataset.action;
    if (action === 'prev') show(current - 1);
    else if (action === 'next') show(current + 1);
    else if (action === 'close' || event.target === dialog || event.target === image) dialog.close();
  });

  dialog.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowLeft') show(current - 1);
    if (event.key === 'ArrowRight') show(current + 1);
  });

  dialog.addEventListener('close', function () {
    buttons[current].focus();
  });
})();
