// A picture for each mood, shown in the Mood knob's face. All from Wikimedia
// Commons and freely licensed. The current one is credited in the footer
// with the articles (author, licence, a link to its Commons page).
//
// [focus] frames the picture in the circle: [x] and [y] place it (as CSS
// background-position percentages) and [zoom] enlarges it past "cover".

const THUMB = 'https://upload.wikimedia.org/wikipedia/commons/thumb';

export const MOOD_PICTURES = {
  dreamy: {
    alt: 'White clouds in a blue sky',
    src: `${THUMB}/4/4b/White_Cumulus_Clouds_against_Blue_Sky_%284%29.jpg/500px-White_Cumulus_Clouds_against_Blue_Sky_%284%29.jpg`,
    file: 'White_Cumulus_Clouds_against_Blue_Sky_(4).jpg',
    author: 'Lance Vanlewen',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    focus: { x: 30, y: 45, zoom: 1.2 },
  },
  sunny: {
    alt: 'A field of sunflowers',
    src: `${THUMB}/f/f6/Sunflower_field_-_panoramio_%2811%29.jpg/500px-Sunflower_field_-_panoramio_%2811%29.jpg`,
    file: 'Sunflower_field_-_panoramio_(11).jpg',
    author: 'Björn S.',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    focus: { x: 50, y: 50, zoom: 1 },
  },
  boogie: {
    alt: 'James Brown at Tulane Stadium in 1970',
    src: `${THUMB}/4/42/James_Brown_at_Tulane_Stadium_24_October_1970.jpg/500px-James_Brown_at_Tulane_Stadium_24_October_1970.jpg`,
    file: 'James_Brown_at_Tulane_Stadium_24_October_1970.jpg',
    author: 'an uncredited photographer for the Jambalaya yearbook',
    license: 'Public domain',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:James_Brown_at_Tulane_Stadium_24_October_1970.jpg',
    focus: { x: 50, y: 45, zoom: 1.6 },
  },
  floaty: {
    alt: 'A moon jellyfish',
    src: `${THUMB}/5/5c/Aurelia_aurita_2.jpg/500px-Aurelia_aurita_2.jpg`,
    file: 'Aurelia_aurita_2.jpg',
    author: 'Hans Hillewaert',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    focus: { x: 50, y: 50, zoom: 1.15 },
  },
  jazzy: {
    alt: 'A swing dance aerial',
    src: `${THUMB}/c/cf/Swing_dance_aerial.jpg/500px-Swing_dance_aerial.jpg`,
    file: 'Swing_dance_aerial.jpg',
    author: 'Joe Mabel',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    focus: { x: 52, y: 50, zoom: 1 },
  },
  moody: {
    alt: 'Rain on a window pane',
    src: `${THUMB}/2/2a/Rain_on_a_window_pane.jpg/500px-Rain_on_a_window_pane.jpg`,
    file: 'Rain_on_a_window_pane.jpg',
    author: 'Theactivistuk',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    focus: { x: 50, y: 50, zoom: 1 },
  },
  mysterious: {
    alt: 'Lista lighthouse on a foggy night',
    src: `${THUMB}/a/a6/Lista_lighthouse_on_a_foggy_night_%2842733242774%29.jpg/500px-Lista_lighthouse_on_a_foggy_night_%2842733242774%29.jpg`,
    file: 'Lista_lighthouse_on_a_foggy_night_(42733242774).jpg',
    author: 'Einar Mostad',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0',
    focus: { x: 66, y: 40, zoom: 1.6 },
  },
  spooky: {
    alt: 'A 1919 Halloween postcard of a witch and her black cat',
    src: `${THUMB}/3/3d/Hallowe%27en_postcard_circa_1919.jpg/500px-Hallowe%27en_postcard_circa_1919.jpg`,
    file: "Hallowe'en_postcard_circa_1919.jpg",
    author: 'an unknown artist for Raphael Tuck & Sons',
    license: 'Public domain',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Hallowe%27en_postcard_circa_1919.jpg',
    focus: { x: 40, y: 32, zoom: 1.5 },
  },
};

export const commonsPage = (file) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`;
