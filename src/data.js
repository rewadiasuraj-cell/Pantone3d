/* Pantone3D — site content.
 *
 * To confirm with Pantone3D before launch (tracked in README, never shown on the
 * page): which materials are sold, which colours exist per material, the swatch
 * values, and the wording of each description. Descriptions are deliberately
 * qualitative (no temperatures, tolerances, strengths or certifications).
 */

/* Contact details. Leave a value empty and that item stays hidden everywhere
 * (footer, nav "Contact" link, "Contact us" buttons). Only add real details. */
export const CONTACT = {
  email: '',
  phone: '',
  address: '',
  instagram: '',
  linkedin: '',
  youtube: '',
};

export const BRAND_YELLOW = '#F7B102'; // sampled from supplied product photography; confirm official value

export const COLOURS = {
  black:   { name: 'Black',        hex: '#1C1C1E' },
  white:   { name: 'White',        hex: '#EEECE5' },
  grey:    { name: 'Grey',         hex: '#808386' },
  red:     { name: 'Red',          hex: '#C41E28' },
  orange:  { name: 'Orange',       hex: '#EC681A' },
  yellow:  { name: 'Yellow',       hex: BRAND_YELLOW },
  green:   { name: 'Green',        hex: '#188448' },
  blue:    { name: 'Blue',         hex: '#1C4CB8' },
  natural: { name: 'Natural',      hex: '#E2D8BE' },
  carbon:  { name: 'Carbon Black', hex: '#2E2F32' },
};

/* Colour section — shown on PLA+. */
export const COLOUR_STORY = ['black', 'white', 'grey', 'red', 'orange', 'yellow', 'green', 'blue'];

export const MATERIALS = [
  {
    id: 'pla-plus', name: 'PLA+', line: 'Everyday reliability.',
    desc: 'Reliable everyday material for clean, precise printing.',
    bestFor: 'Everyday prints · Prototypes · Display models',
    traits: ['Smooth flow', 'Clean finish', 'Consistent colour'],
    colour: 'yellow', shape: 'vase', matte: false,
    colours: ['black', 'white', 'grey', 'red', 'orange', 'yellow', 'green', 'blue'],
  },
  {
    id: 'matte-pla', name: 'Matte PLA', line: 'Quiet, low-sheen surfaces.',
    desc: 'A low-sheen surface that softens the look of layer lines.',
    bestFor: 'Design models · Presentation pieces · Décor',
    traits: ['Matte surface', 'Soft appearance', 'Easy printing'],
    colour: 'white', shape: 'cylinder', matte: true,
    colours: ['black', 'white', 'grey'],
  },
  {
    id: 'petg', name: 'PETG', line: 'Durable everyday utility.',
    desc: 'A durable all-rounder for parts that have to work as well as look right.',
    bestFor: 'Functional parts · Enclosures · Everyday utility',
    traits: ['Durable', 'Functional', 'Versatile'],
    colour: 'blue', shape: 'bottle', matte: false,
    colours: ['black', 'white', 'blue'],
  },
  {
    id: 'abs', name: 'ABS', line: 'The engineering classic.',
    desc: 'A long-established engineering material for sturdy, finishable parts.',
    bestFor: 'Housings · Jigs and fixtures · Finished parts',
    traits: ['Sturdy parts', 'Workable finish', 'Engineering use'],
    colour: 'red', shape: 'hexbox', matte: false,
    colours: ['black', 'white', 'red', 'grey'],
  },
  {
    id: 'nylon', name: 'Nylon', line: 'Tough, resilient parts.',
    desc: 'A tough, resilient material for demanding mechanical parts.',
    bestFor: 'Gears · Hinges · Wear parts',
    traits: ['Tough', 'Resilient', 'Mechanical use'],
    colour: 'natural', shape: 'gear', matte: false,
    colours: ['natural', 'black'],
  },
  {
    id: 'carbon-fiber', name: 'Carbon Fiber', line: 'Rigid, technical finish.',
    desc: 'A fibre-filled material for rigid parts with a technical, matte finish.',
    bestFor: 'Brackets · RC and drone parts · Tooling',
    traits: ['Rigid parts', 'Technical finish', 'Matte texture'],
    colour: 'carbon', shape: 'tri', matte: true,
    colours: ['carbon'],
  },
];

export const APPLICATIONS = [
  { name: 'Prototyping',       note: 'Test form and fit before committing to production.', shape: 'hexbox',  icon: 'cube',   colour: 'grey' },
  { name: 'Product Design',    note: 'Presentation models with a considered finish.',     shape: 'lamp',    icon: 'bulb',   colour: 'white' },
  { name: 'Education',         note: 'Tangible objects for learning by making.',          shape: 'gear',    icon: 'cap',    colour: 'blue' },
  { name: 'Maker Projects',    note: 'From weekend builds to ongoing projects.',          shape: 'star',    icon: 'wrench', colour: 'orange' },
  { name: 'Functional Parts',  note: 'Parts that are meant to be used, not just seen.',   shape: 'bushing', icon: 'gear',   colour: 'carbon' },
  { name: 'Creative Printing', note: 'Sculptural forms, décor and experiments.',           shape: 'organic', icon: 'flower', colour: 'red' },
];

export const spoolSrc = (colour, small = false) => `assets/img/spool-${colour}${small ? '-sm' : ''}.webp?v=20261005e`;
/* Close-up of the wound filament, cropped from the same product photography. */
export const texSrc = (colour) => `assets/img/tex-${colour}.webp`;

export const hasContact = () => Object.values(CONTACT).some(Boolean);
