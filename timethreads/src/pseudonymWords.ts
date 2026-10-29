// Word lists for generated pseudonyms ("Amber Otter"). Each user gets one
// adjective + one animal, and every combination can only be claimed once
// (see ensureUser in actions.ts and /pseudonyms in firestore.rules).
//
// 154 adjectives x 156 animals = 24,024 unique names. To add more, append
// words to either list: one capitalized word each, no spaces, nothing that
// could read as an insult. Never remove or rename a word that may already
// be in use; existing users keep their names either way.

export const ADJECTIVES = [
  'Amber', 'Ancient', 'Agile', 'Airy', 'Arctic', 'Ashen', 'Astral', 'Autumn',
  'Azure', 'Balmy', 'Bold', 'Brave', 'Breezy', 'Bright', 'Brisk', 'Bronze',
  'Calm', 'Candid', 'Careful', 'Cedar', 'Cheerful', 'Clever', 'Cobalt', 'Copper',
  'Coral', 'Cosmic', 'Crimson', 'Crystal', 'Curious', 'Dapper', 'Daring', 'Dawn',
  'Dazzling', 'Deft', 'Diligent', 'Dreamy', 'Dusky', 'Eager', 'Earnest', 'Ebony',
  'Electric', 'Emerald', 'Epic', 'Fabled', 'Fearless', 'Feathered', 'Fiery', 'Fleet',
  'Floral', 'Fluent', 'Frosty', 'Gallant', 'Gentle', 'Gilded', 'Glacial', 'Gleaming',
  'Glowing', 'Golden', 'Graceful', 'Grand', 'Hardy', 'Harmonic', 'Hazel', 'Heroic',
  'Hidden', 'Honest', 'Humble', 'Icy', 'Indigo', 'Ivory', 'Jade', 'Jolly',
  'Jovial', 'Keen', 'Kind', 'Lantern', 'Lavender', 'Legendary', 'Lively', 'Lofty',
  'Loyal', 'Lucky', 'Lunar', 'Majestic', 'Marble', 'Mellow', 'Merry', 'Midnight',
  'Mighty', 'Misty', 'Modest', 'Mossy', 'Noble', 'Nimble', 'Northern', 'Oaken',
  'Ocean', 'Onyx', 'Opal', 'Patient', 'Pearl', 'Peppy', 'Placid', 'Plucky',
  'Polar', 'Proud', 'Quick', 'Quiet', 'Radiant', 'Rapid', 'Regal', 'Restless',
  'Rosy', 'Royal', 'Ruby', 'Rustic', 'Sage', 'Sandy', 'Sapphire', 'Scarlet',
  'Serene', 'Shady', 'Silent', 'Silver', 'Sincere', 'Sleek', 'Snowy', 'Solar',
  'Spirited', 'Spry', 'Starry', 'Steady', 'Stellar', 'Stormy', 'Sturdy', 'Summer',
  'Sunny', 'Swift', 'Tawny', 'Thoughtful', 'Timber', 'Tranquil', 'Twilight', 'Velvet',
  'Verdant', 'Vivid', 'Wandering', 'Warm', 'Whimsical', 'Wild', 'Winter', 'Wise',
  'Witty', 'Zesty',
] as const

export const ANIMALS = [
  'Albatross', 'Alpaca', 'Anteater', 'Antelope', 'Armadillo', 'Axolotl', 'Badger', 'Barracuda',
  'Beaver', 'Bison', 'Blackbird', 'Bluejay', 'Bobcat', 'Buffalo', 'Butterfly', 'Camel',
  'Capybara', 'Cardinal', 'Caribou', 'Cassowary', 'Chameleon', 'Cheetah', 'Chickadee', 'Chinchilla',
  'Chipmunk', 'Cicada', 'Condor', 'Cormorant', 'Cougar', 'Coyote', 'Crane', 'Cricket',
  'Crow', 'Curlew', 'Deer', 'Dingo', 'Dolphin', 'Dormouse', 'Dove', 'Dragonfly',
  'Duck', 'Eagle', 'Egret', 'Eland', 'Elephant', 'Elk', 'Emu', 'Ermine',
  'Falcon', 'Ferret', 'Finch', 'Firefly', 'Flamingo', 'Fox', 'Gazelle', 'Gecko',
  'Gibbon', 'Giraffe', 'Goldfinch', 'Goose', 'Gopher', 'Gorilla', 'Grasshopper', 'Grouse',
  'Hare', 'Hawk', 'Hedgehog', 'Heron', 'Hippo', 'Hummingbird', 'Ibex', 'Ibis',
  'Iguana', 'Impala', 'Jackrabbit', 'Jaguar', 'Jellyfish', 'Kangaroo', 'Kestrel', 'Kingfisher',
  'Kiwi', 'Koala', 'Kookaburra', 'Ladybug', 'Lemur', 'Leopard', 'Llama', 'Lobster',
  'Loon', 'Lynx', 'Macaw', 'Magpie', 'Manatee', 'Marmot', 'Marten', 'Meerkat',
  'Mink', 'Mockingbird', 'Mongoose', 'Moose', 'Narwhal', 'Newt', 'Nightingale', 'Ocelot',
  'Octopus', 'Okapi', 'Oriole', 'Oryx', 'Osprey', 'Ostrich', 'Otter', 'Owl',
  'Panda', 'Panther', 'Parrot', 'Partridge', 'Peacock', 'Pelican', 'Penguin', 'Pheasant',
  'Platypus', 'Porcupine', 'Puffin', 'Quail', 'Quokka', 'Rabbit', 'Raccoon', 'Raven',
  'Reindeer', 'Robin', 'Salamander', 'Sandpiper', 'Seahorse', 'Seal', 'Sparrow', 'Squirrel',
  'Starling', 'Stingray', 'Stork', 'Swallow', 'Swan', 'Tapir', 'Tiger', 'Tortoise',
  'Toucan', 'Turtle', 'Walrus', 'Warbler', 'Weasel', 'Whale', 'Wolf', 'Wombat',
  'Woodpecker', 'Wren', 'Yak', 'Zebra',
] as const