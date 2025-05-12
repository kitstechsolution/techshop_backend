import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';
import { logger } from './logger.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce';

// User seed data
const seedUsers = [
  {
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@example.com',
    password: 'admin123',
    role: 'admin' as const,
  },
  {
    firstName: 'Test',
    lastName: 'User',
    email: 'user@example.com',
    password: 'user123',
    role: 'user' as const,
  },
  {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    password: 'password123',
    role: 'user' as const,
  },
  {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    password: 'password123',
    role: 'user' as const,
  },
  {
    firstName: 'Robert',
    lastName: 'Johnson',
    email: 'robert@example.com',
    password: 'password123',
    role: 'user' as const,
  },
  {
    firstName: 'Emily',
    lastName: 'Williams',
    email: 'emily@example.com',
    password: 'password123',
    role: 'user' as const,
  },
  {
    firstName: 'Michael',
    lastName: 'Brown',
    email: 'michael@example.com',
    password: 'password123',
    role: 'user' as const,
  },
];

const productCategories = [
  {
    name: 'Microcontrollers',
    subcategories: ['Arduino', 'Raspberry Pi', 'ESP32/ESP8266'],
  },
  {
    name: 'Sensors & Modules',
    subcategories: ['Motion & Position', 'Environmental', 'Optical & Imaging'],
  },
  {
    name: 'Robotics',
    subcategories: ['Motors & Servos', 'Robot Chassis & Kits', 'Motor Controllers'],
  },
  {
    name: 'Electronic Components',
    subcategories: ['Passive Components', 'Active Components', 'Connectors & Wires'],
  },
  {
    name: 'Tools & Equipment',
    subcategories: ['Soldering Equipment', 'Testing & Measurement', 'Hand Tools'],
  },
];

export { productCategories };

// Product seed data
const seedProducts = [
  {
    name: 'Arduino Uno R4 WiFi',
    price: 3499.00,
    description: 'Latest Arduino board with built-in WiFi, perfect for IoT projects. Features the new RA4M1 32-bit processor and enhanced capabilities.',
    imageUrl: 'https://images.unsplash.com/photo-1608564697071-776cb4128798?w=720',
    category: 'microcontrollers',
    subcategory: 'arduino',
    stock: 25,
  },
  {
    name: 'Raspberry Pi 5',
    price: 6999.00,
    description: 'The newest Raspberry Pi with 2.4GHz quad-core CPU, up to 8GB RAM, and enhanced GPU performance.',
    imageUrl: 'https://images.unsplash.com/photo-1596783074918-c84cb06531ca?w=720',
    category: 'microcontrollers',
    subcategory: 'raspberry-pi',
    stock: 10,
  },
  {
    name: 'ESP32-CAM Module',
    price: 899.00,
    description: 'ESP32 development board with integrated camera, perfect for IoT video streaming and surveillance projects.',
    imageUrl: 'https://images.unsplash.com/photo-1555664424-778a1e5e1b48?w=720',
    category: 'microcontrollers',
    subcategory: 'esp32-esp8266',
    stock: 50,
  },
  {
    name: 'MPU6050 6-Axis Sensor',
    price: 299.00,
    description: '6-DOF sensor with accelerometer and gyroscope, ideal for motion tracking and stabilization projects.',
    imageUrl: 'https://images.unsplash.com/photo-1601026909931-35929748c8de?w=720',
    category: 'sensors-modules',
    subcategory: 'motion-position',
    stock: 100,
  },
  {
    name: 'Nema 17 Stepper Motor',
    price: 799.00,
    description: 'High-torque stepper motor perfect for 3D printers, CNC machines, and robotic projects.',
    imageUrl: 'https://images.unsplash.com/photo-1580053226683-5dc45b677165?w=720',
    category: 'robotics',
    subcategory: 'motors-servos',
    stock: 30,
  },
  {
    name: 'Robot Chassis Kit',
    price: 2499.00,
    description: '2WD robot chassis with motors, wheels, and mounting hardware. Perfect for beginner robotics projects.',
    imageUrl: 'https://images.unsplash.com/photo-1580477371194-4a8199941315?w=720',
    category: 'robotics',
    subcategory: 'robot-chassis-kits',
    stock: 15,
  },
  {
    name: 'Digital Multimeter',
    price: 1499.00,
    description: 'Professional digital multimeter with auto-ranging capability for voltage, current, and resistance measurements.',
    imageUrl: 'https://images.unsplash.com/photo-1563770557593-e9c1022e9dc6?w=720',
    category: 'tools-equipment',
    subcategory: 'testing-measurement',
    stock: 20,
  },
  {
    name: 'Soldering Station',
    price: 4999.00,
    description: 'Temperature-controlled soldering station with digital display and multiple tips included.',
    imageUrl: 'https://images.unsplash.com/photo-1563406580273-789b11d17ccc?w=720',
    category: 'tools-equipment',
    subcategory: 'soldering-equipment',
    stock: 12,
  },
  {
    name: 'Arduino Uno R3',
    price: 599.99,
    description: 'The classic Arduino board perfect for beginners and simple projects.',
    imageUrl: 'https://images.unsplash.com/photo-1608564697071-776cb4128798?w=150&q=80',
    category: 'microcontrollers',
    subcategory: 'arduino',
    stock: 35,
  },
  {
    name: 'Raspberry Pi 4',
    price: 4999.99,
    description: 'Powerful single-board computer for various computing and IoT projects.',
    imageUrl: 'https://images.unsplash.com/photo-1596783074918-c84cb06531ca?w=150&q=80',
    category: 'microcontrollers',
    subcategory: 'raspberry-pi',
    stock: 15,
  },
  {
    name: 'Ultrasonic Sensor Kit',
    price: 899.99,
    description: 'Distance measurement sensor kit for robotics and automation projects.',
    imageUrl: 'https://images.unsplash.com/photo-1555664424-778a1e5e1b48?w=150&q=80',
    category: 'sensors-modules',
    subcategory: 'environmental',
    stock: 60,
  },
  {
    name: 'Motor Driver Shield',
    price: 499.99,
    description: 'Shield for controlling DC motors with Arduino boards.',
    imageUrl: 'https://images.unsplash.com/photo-1601026909931-35929748c8de?w=150&q=80',
    category: 'robotics',
    subcategory: 'motor-controllers',
    stock: 40,
  },
  {
    name: 'LED Matrix Display',
    price: 249.99,
    description: '8x8 LED matrix for creating scrolling text and simple graphics displays.',
    imageUrl: 'https://images.unsplash.com/photo-1580053226683-5dc45b677165?w=150&q=80',
    category: 'electronic-components',
    subcategory: 'active-components',
    stock: 45,
  },
  {
    name: 'Robotic Arm Kit',
    price: 2899.99,
    description: 'DIY robotic arm with servo motors and controller board.',
    imageUrl: 'https://images.unsplash.com/photo-1580477371194-4a8199941315?w=150&q=80',
    category: 'robotics',
    subcategory: 'robot-chassis-kits',
    stock: 8,
  },
  {
    name: 'NodeMCU ESP8266',
    price: 699.99,
    description: 'WiFi-enabled development board based on ESP8266.',
    imageUrl: 'https://images.unsplash.com/photo-1563406580273-789b11d17ccc?w=150&q=80',
    category: 'microcontrollers',
    subcategory: 'esp32-esp8266',
    stock: 25,
  },
  {
    name: 'Servo Motor Pack',
    price: 349.99,
    description: 'Set of 5 micro servo motors for robotics and automation.',
    imageUrl: 'https://images.unsplash.com/photo-1563770557593-e9c1022e9dc6?w=150&q=80',
    category: 'robotics',
    subcategory: 'motors-servos',
    stock: 30,
  },
];

// Create sample order data
const createSampleOrders = async (users: any, products: any) => {
  const sampleShippingAddresses = [
    {
      street: '123 Main St',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
    },
    {
      street: '456 Park Ave',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
    },
    {
      street: '789 Oak Rd',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001',
    },
    {
      street: '321 Elm St',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600001',
    },
    {
      street: '654 Pine Ln',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500001',
    },
  ];

  const orderStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  const paymentStatuses = ['pending', 'completed', 'failed'];

  // Calculate order total from items
  const calculateTotal = (items: any[]): number => {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const sampleOrders = [
    // Order 1
    {
      user: users[2]._id, // John Doe
      items: [
        {
          product: products[8]._id, // Arduino Uno R3
          name: products[8].name,
          price: products[8].price,
          quantity: 1,
        },
        {
          product: products[9]._id, // Raspberry Pi 4
          name: products[9].name,
          price: products[9].price,
          quantity: 2,
        },
      ],
      shippingAddress: sampleShippingAddresses[0],
      status: 'delivered',
      paymentStatus: 'completed',
      trackingNumber: 'TRK123456',
      total: 0, // Will be calculated before saving
    },
    // Order 2
    {
      user: users[3]._id, // Jane Smith
      items: [
        {
          product: products[10]._id, // Ultrasonic Sensor Kit
          name: products[10].name,
          price: products[10].price,
          quantity: 1,
        },
      ],
      shippingAddress: sampleShippingAddresses[1],
      status: 'processing',
      paymentStatus: 'completed',
      total: 0, // Will be calculated before saving
    },
    // Order 3
    {
      user: users[4]._id, // Robert Johnson
      items: [
        {
          product: products[11]._id, // Motor Driver Shield
          name: products[11].name,
          price: products[11].price,
          quantity: 1,
        },
        {
          product: products[12]._id, // LED Matrix Display
          name: products[12].name,
          price: products[12].price,
          quantity: 1,
        },
      ],
      shippingAddress: sampleShippingAddresses[2],
      status: 'shipped',
      paymentStatus: 'completed',
      trackingNumber: 'TRK789012',
      total: 0, // Will be calculated before saving
    },
    // Order 4
    {
      user: users[5]._id, // Emily Williams
      items: [
        {
          product: products[13]._id, // Robotic Arm Kit
          name: products[13].name,
          price: products[13].price,
          quantity: 1,
        },
      ],
      shippingAddress: sampleShippingAddresses[3],
      status: 'pending',
      paymentStatus: 'pending',
      total: 0, // Will be calculated before saving
    },
    // Order 5
    {
      user: users[6]._id, // Michael Brown
      items: [
        {
          product: products[14]._id, // NodeMCU ESP8266
          name: products[14].name,
          price: products[14].price,
          quantity: 3,
        },
        {
          product: products[15]._id, // Servo Motor Pack
          name: products[15].name,
          price: products[15].price,
          quantity: 2,
        },
      ],
      shippingAddress: sampleShippingAddresses[4],
      status: 'cancelled',
      paymentStatus: 'failed',
      total: 0, // Will be calculated before saving
    },
  ];

  // Add calculated totals to sample orders
  sampleOrders.forEach(order => {
    order.total = calculateTotal(order.items);
  });

  // Add a few more random orders to increase the dataset
  const randomOrders = [];
  
  for (let i = 0; i < 15; i++) {
    const randomUser = users[Math.floor(Math.random() * users.length)];
    const randomProductCount = Math.floor(Math.random() * 3) + 1; // 1-3 products
    const randomItems = [];
    
    for (let j = 0; j < randomProductCount; j++) {
      const randomProduct = products[Math.floor(Math.random() * products.length)];
      const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 items
      
      randomItems.push({
        product: randomProduct._id,
        name: randomProduct.name,
        price: randomProduct.price,
        quantity,
      });
    }
    
    const randomStatus = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];
    const randomPaymentStatus = paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)];
    const randomAddress = sampleShippingAddresses[Math.floor(Math.random() * sampleShippingAddresses.length)];
    
    const orderTotal = calculateTotal(randomItems);
    
    randomOrders.push({
      user: randomUser._id,
      items: randomItems,
      shippingAddress: randomAddress,
      status: randomStatus,
      paymentStatus: randomPaymentStatus,
      trackingNumber: randomStatus === 'shipped' || randomStatus === 'delivered' ? `TRACK${1000 + i}` : undefined,
      total: orderTotal,
    });
  }
  
  const ordersToCreate = [...sampleOrders, ...randomOrders];
  logger.info(`Creating ${ordersToCreate.length} orders...`);
  await Order.create(ordersToCreate);
  logger.info(`${ordersToCreate.length} orders created`);
};

const seedDatabase = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    mongoose.set('strictQuery', false);
    logger.info(`Connecting to MongoDB at ${MONGODB_URI}`);
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB');

    // Clear existing data
    logger.info('Clearing existing data...');
    await User.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    logger.info('Existing data cleared');

    // Seed users
    logger.info('Seeding users...');
    const users = await User.create(seedUsers);
    logger.info(`${users.length} users seeded`);

    // Seed products
    logger.info('Seeding products...');
    const products = await Product.create(seedProducts);
    logger.info(`${products.length} products seeded`);

    // Create sample orders
    logger.info('Creating sample orders...');
    await createSampleOrders(users, products);
    logger.info('Sample orders created');

    logger.info('Database seeded successfully!');
  } catch (error) {
    logger.error('Error seeding database:', error);
  } finally {
    // Disconnect from database
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
};

// In ES modules, we need a different approach to detect if a file is run directly
// This replaces the CommonJS pattern of `require.main === module`
const isMainModule = process.argv[1] && process.argv[1].includes('seed.ts');

if (isMainModule) {
  // Run the seed function if this file is called directly
  void seedDatabase();
}

export { seedDatabase }; 