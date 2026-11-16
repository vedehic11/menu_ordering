import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DEFAULT_CAROUSEL_SLIDES } from '../src/lib/storage';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding My, Oh My...');

  // 1. Restaurant
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: 'my-oh-my-andheri' },
    update: {
      name: 'My, Oh My',
      address: 'Plot B-45, Off New Link Road, Veera Desai, Andheri West, Mumbai 400053',
      phone: '+91 98200 54321',
      email: 'cheftable@myohmy.in',
    },
    create: {
      id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      name: 'My, Oh My',
      slug: 'my-oh-my-andheri',
      address: 'Plot B-45, Off New Link Road, Veera Desai, Andheri West, Mumbai 400053',
      phone: '+91 98200 54321',
      email: 'cheftable@myohmy.in',
      currency: 'INR',
      isOpen: true,
    },
  });

  // 2. Dining Tables
  const tables = [
    { tableNumber: 'Table 1', previousName: 'Table 1 • Live Kitchen Front' },
    { tableNumber: 'Table 2', previousName: 'Table 2 • Bar Lounge' },
    { tableNumber: 'Table 3', previousName: 'Table 3 • Courtyard Booth' },
    { tableNumber: 'Table 4', previousName: 'Table 4 • High Top Patio' },
    { tableNumber: 'Table 5', previousName: 'Table 5 • Mezzanine Dining' },
  ];

  for (const { tableNumber, previousName } of tables) {
    const existing = await prisma.diningTable.findFirst({
      where: {
        restaurantId: restaurant.id,
        OR: [{ tableNumber }, { tableNumber: previousName }],
      },
    });
    const isInsecureSampleToken = existing && /^([1-5])\1{7}(-\1{3}){3}-\1{11}$/.test(existing.qrToken);
    if (existing) {
      await prisma.diningTable.update({
        where: { id: existing.id },
        data: {
          tableNumber,
          ...(isInsecureSampleToken && { qrToken: randomUUID() }),
        },
      });
    } else {
      await prisma.diningTable.create({
        data: {
        restaurantId: restaurant.id,
        tableNumber,
        qrToken: randomUUID(),
        isActive: true,
      },
      });
    }
  }

  for (const [index, slide] of DEFAULT_CAROUSEL_SLIDES.entries()) {
    const id = `seed-carousel-${index + 1}`;
    const existing = await prisma.carouselSlide.findUnique({ where: { id } });
    if (!existing) {
      await prisma.carouselSlide.create({
        data: {
          id,
          restaurantId: restaurant.id,
          title: slide.title,
          sub: slide.sub,
          image: slide.image,
          isActive: slide.isActive ?? true,
          displayOrder: index,
        },
      });
    }
  }

  const initialOwnerPin = process.env.INITIAL_OWNER_PIN;
  if (!initialOwnerPin || initialOwnerPin.length < 8 || !/^\d+$/.test(initialOwnerPin)) {
    throw new Error('Set INITIAL_OWNER_PIN to a unique PIN of at least 8 digits before seeding production.');
  }
  const ownerEmail = process.env.INITIAL_OWNER_EMAIL;
  const ownerName = process.env.INITIAL_OWNER_NAME || 'Restaurant Owner';
  const ownerPinHash = await bcrypt.hash(initialOwnerPin, await bcrypt.genSalt(10));
  if (ownerEmail) {
    await prisma.staffMember.upsert({
      where: { email: ownerEmail },
      update: { name: ownerName, role: 'owner', pinHash: ownerPinHash, isActive: true },
      create: {
        restaurantId: restaurant.id,
        name: ownerName,
        email: ownerEmail,
        role: 'owner',
        pinHash: ownerPinHash,
        isActive: true,
      },
    });
  } else {
    const owner = await prisma.staffMember.findFirst({
      where: { restaurantId: restaurant.id, role: 'owner' },
    });
    if (owner) {
      await prisma.staffMember.update({
        where: { id: owner.id },
        data: { name: ownerName, pinHash: ownerPinHash, isActive: true },
      });
    } else {
      await prisma.staffMember.create({
        data: {
          restaurantId: restaurant.id,
          name: ownerName,
          role: 'owner',
          pinHash: ownerPinHash,
          isActive: true,
        },
      });
    }
  }

  // 3. Categories & Dishes
  const categoriesWithDishes = [
    {
      name: 'Live Robata & Small Plates',
      desc: 'Charcoal-fired skewers, dumplings, and tapas from the open grill',
      order: 1,
      station: 'robata' as const,
      dishes: [
        {
          name: 'Truffle & Edamame Crystal Dumplings',
          desc: 'Handmade translucent wrapper, black summer truffle emulsion, water chestnut crunch, chili ponzu',
          price: 49500,
          veg: true,
          img: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=800&q=80',
          isChefSpecial: true,
        },
        {
          name: 'Smoked Stracciatella & Tomato Tartine',
          desc: 'Toasted rustic sourdough, pulled stracciatella, roasted garlic confit, aged Modena reduction',
          price: 52500,
          veg: true,
          img: 'https://images.unsplash.com/photo-1592417817098-8f3d6910985b?auto=format&fit=crop&w=800&q=80',
        },
        {
          name: 'Guntur Chili & Garlic Butter King Prawns',
          desc: 'Live grill charred prawns, roasted Guntur pepper butter, lemon zest aioli, crusty focaccia',
          price: 74500,
          veg: false,
          img: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=800&q=80',
          isChefSpecial: true,
        },
        {
          name: 'Pulled Lamb Shank Brioche Sliders (2 pcs)',
          desc: '18-hour braised spiced lamb, pickled cucumber ribbons, harissa garlic labneh, warm butter brioche',
          price: 59500,
          veg: false,
          img: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
        },
      ],
    },
    {
      name: 'Wood-Fired Sourdough Pizzas',
      desc: '48-hour fermented dough fired at 450°C with San Marzano tomatoes',
      order: 2,
      station: 'pizza' as const,
      dishes: [
        {
          name: 'Burrata, Black Fig & Hot Honey Pizza',
          desc: 'San Marzano DOP, creamy Italian burrata, mission figs, crushed walnuts, chili hot honey drizzle',
          price: 72500,
          veg: true,
          img: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80',
        },
        {
          name: 'Smoked Pepperoni & Fermented Jalapeño Pizza',
          desc: 'Imported artisanal pork pepperoni, Fior di Latte mozzarella, charred red jalapeños, fresh basil',
          price: 78500,
          veg: false,
          img: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=800&q=80',
        },
        {
          name: 'Wild Forest Truffle Mushroom Bianca',
          desc: 'Confit garlic cream base, portobello & button mushrooms, fontina cheese, white truffle drizzle',
          price: 69500,
          veg: true,
          img: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=800&q=80',
        },
      ],
    },
    {
      name: 'Mains',
      desc: 'Signature slow braises, coastal seafood, and hand-rolled pastas',
      order: 3,
      station: 'mains' as const,
      dishes: [
        {
          name: 'Pan-Roasted Atlantic Salmon',
          desc: 'Crispy skin salmon, sweet potato silk, buttered asparagus, charred lemon caper velouté',
          price: 119500,
          veg: false,
          img: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80',
        },
        {
          name: 'Saffron & Wild Morel Risotto',
          desc: 'Aged Acquerello carnaroli rice, Kashmiri saffron threads, sautéed morels, 24-month Parmigiano',
          price: 79500,
          veg: true,
          img: 'https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?auto=format&fit=crop&w=800&q=80',
          isChefSpecial: true,
        },
        {
          name: 'Slow Braised Lamb Shank',
          desc: '24-hour slow braise in port wine jus, saffron potato mash, roasted heirloom baby carrots',
          price: 115000,
          veg: false,
          img: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
        },
      ],
    },
    {
      name: 'Craft Botanical Elixirs & Brews',
      desc: 'House-clarified cordials, botanical tonics, and cold-pressed infusions',
      order: 4,
      station: 'bar' as const,
      dishes: [
        {
          name: 'Andheri Sunset Spritz (Signature)',
          desc: 'Cold-pressed blood orange, clarified passionfruit essence, sparkling tonic, torched rosemary',
          price: 34500,
          veg: true,
          img: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
        },
        {
          name: 'Smoked Rosemary Botanical Tonic',
          desc: 'Clarified ruby grapefruit, hand-crushed juniper botanicals, smoked Himalayan pine salt rim',
          price: 32500,
          veg: true,
          img: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=800&q=80',
        },
        {
          name: 'Japanese Yuzu & Jasmine Cold Infusion',
          desc: 'First-flush loose leaf green tea, fresh Kochi yuzu juice, elderflower cloud foam',
          price: 29500,
          veg: true,
          img: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?auto=format&fit=crop&w=800&q=80',
        },
      ],
    },
    {
      name: 'Pastry Studio Desserts',
      desc: 'French technique meets decadent Belgian chocolates and single-estate vanillas',
      order: 5,
      station: 'pastry' as const,
      dishes: [
        {
          name: '70% Belgian Dark Chocolate Lava Fondant',
          desc: 'Molten Callebaut core, fleur de sel crystals, edible 24k gold foil, Madagascar vanilla bean gelato',
          price: 48500,
          veg: true,
          img: 'https://images.unsplash.com/photo-1579372786545-d24232daf58c?auto=format&fit=crop&w=800&q=80',
        },
        {
          name: 'Classic Venetian Mascarpone Tiramisu',
          desc: 'Espresso-drenched savoiardi biscuits, zabaglione cream mousse, dusting of single-origin raw cacao',
          price: 44500,
          veg: true,
          img: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=800&q=80',
        },
      ],
    },
  ];

  for (const catData of categoriesWithDishes) {
    const category = await prisma.menuCategory.upsert({
      where: { id: `cat-${catData.order}` },
      update: {
        restaurantId: restaurant.id,
        name: catData.name,
        description: catData.desc,
        station: catData.station,
        displayOrder: catData.order,
        isActive: true,
      },
      create: {
        id: `cat-${catData.order}`,
        restaurantId: restaurant.id,
        name: catData.name,
        description: catData.desc,
        station: catData.station,
        displayOrder: catData.order,
        isActive: true,
      },
    });

    for (let idx = 0; idx < catData.dishes.length; idx++) {
      const d = catData.dishes[idx];
      const existingItem = await prisma.menuItem.findFirst({
        where: { categoryId: category.id, name: d.name },
      });
      const itemData = {
          categoryId: category.id,
          name: d.name,
          description: d.desc,
          pricePaise: d.price,
          imageUrl: d.img,
          station: catData.station,
          isVegetarian: d.veg,
          displayOrder: idx + 1,
        };
      if (!existingItem) {
        await prisma.menuItem.create({
          data: {
            ...itemData,
            isAvailable: true,
            isChefSpecial: "isChefSpecial" in d && d.isChefSpecial === true,
          },
        });
      }
    }
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
