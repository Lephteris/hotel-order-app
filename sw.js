const CACHE_NAME = 'hotel-orders-v2';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data.js'
];

// Εγκατάσταση του Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Ενεργοποίηση (Activation) - Καθαρισμός παλιών cache
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Network-First strategy: Δοκιμάζει πρώτα το δίκτυο (ώστε να φέρνει πάντα τα νέα δεδομένα),
// και αν δεν υπάρχει ίντερνετ, χρησιμοποιεί την cache.
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).then(response => {
      // Αν έχουμε ίντερνετ και απάντηση, ανανεώνουμε την cache (προαιρετικό αλλά καλό)
      return caches.open(CACHE_NAME).then(cache => {
        // Δεν αποθηκεύουμε requests που δεν είναι http/https (π.χ. chrome-extension://)
        if(event.request.url.startsWith('http')){
            cache.put(event.request, response.clone());
        }
        return response;
      });
    }).catch(() => {
      // Αν δεν υπάρχει δίκτυο, φέρνουμε το αρχείο από την cache
      return caches.match(event.request);
    })
  );
});
