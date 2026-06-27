import unittest

from server import extractPosterUrl


class ExtractPosterUrlTests(unittest.TestCase):
    def test_extracts_open_graph_poster_url(self):
        html = '<html><head><meta property="og:image" content="https://example.com/poster.jpg" /></head></html>'
        self.assertEqual(extractPosterUrl(html), 'https://example.com/poster.jpg')

    def test_extracts_imdb_primary_image_url(self):
        html = '<html><head><meta property="og:image" content="https://example.com/ignored.jpg" /></head><body><script>window.__INITIAL_STATE__={"images":{"primary":{"url":"https://m.media-amazon.com/image.jpg"}}}</script></body></html>'
        self.assertEqual(extractPosterUrl(html), 'https://m.media-amazon.com/image.jpg')


if __name__ == '__main__':
    unittest.main()
