'use strict';
(function() {
  $('h2,h3').each(function() {
    $(this).prepend(`<a href="#${this.id}" class="fragment-link"><span class="fa fa-link"></span></a>`);
  });
})();
