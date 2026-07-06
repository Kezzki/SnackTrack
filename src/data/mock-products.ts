import type { Product } from "@/types/product";

export const mockProducts: Product[] = [
    { id: "1", name: "Crispy Chips Original", category: "Chips", price: 15000, stock: 23, image: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400", description: "Classic crispy potato chips with just the right amount of salt", rating: 4.8, soldCount: 1245 },
    { id: "2", name: "Chocolate Cookie Delight", category: "Cookies", price: 18000, stock: 156, image: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400", description: "Rich chocolate chip cookies baked to perfection", rating: 4.9, soldCount: 1089 },
    { id: "3", name: "Spicy Nacho Tortillas", category: "Chips", price: 14000, stock: 89, image: "https://images.unsplash.com/photo-1600952841320-db92ec4047ca?w=400", description: "Bold and spicy nacho cheese flavored tortilla chips", rating: 4.6, soldCount: 956 },
    { id: "4", name: "Caramel Popcorn", category: "Popcorn", price: 25000, stock: 67, image: "https://images.unsplash.com/photo-1578849278619-e73505e9610f?w=400", description: "Sweet and crunchy caramel coated popcorn", rating: 4.7, soldCount: 823 },
    { id: "5", name: "Mixed Nuts Premium", category: "Nuts", price: 35000, stock: 45, image: "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=400", description: "Premium blend of roasted almonds, cashews, and walnuts", rating: 4.5, soldCount: 712 },
    { id: "6", name: "Strawberry Gummies", category: "Candy", price: 12000, stock: 234, image: "https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=400", description: "Soft and chewy strawberry flavored gummy candies", rating: 4.4, soldCount: 689 },
    { id: "7", name: "Honey Butter Chips", category: "Chips", price: 17000, stock: 112, image: "https://images.unsplash.com/photo-1621447504864-d8686e12698c?w=400", description: "Sweet and savory honey butter flavored chips", rating: 4.8, soldCount: 567 },
    { id: "8", name: "Dark Chocolate Almonds", category: "Nuts", price: 30000, stock: 78, image: "https://images.unsplash.com/photo-1607920592519-bab91e95a068?w=400", description: "Roasted almonds covered in rich dark chocolate", rating: 4.7, soldCount: 445 },
    { id: "9", name: "Butter Popcorn Classic", category: "Popcorn", price: 18000, stock: 189, image: "https://images.unsplash.com/photo-1585238342024-78d387f4a707?w=400", description: "Classic movie-style butter popcorn", rating: 4.6, soldCount: 534 },
    { id: "10", name: "Sour Gummy Worms", category: "Candy", price: 13000, stock: 167, image: "https://images.unsplash.com/photo-1598531206458-aad47fa6c9b3?w=400", description: "Tangy and sour gummy worms in assorted flavors", rating: 4.3, soldCount: 423 },
    { id: "11", name: "Oatmeal Raisin Cookies", category: "Cookies", price: 20000, stock: 94, image: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400", description: "Wholesome oatmeal cookies with plump raisins", rating: 4.4, soldCount: 378 },
    { id: "12", name: "BBQ Kettle Chips", category: "Chips", price: 16000, stock: 203, image: "https://images.unsplash.com/photo-1613919113640-25732ec5e61f?w=400", description: "Kettle-cooked chips with smoky BBQ flavor", rating: 4.5, soldCount: 612 },
];

export const sellerCategories = ["All", "Chips", "Cookies", "Popcorn", "Nuts", "Candy"];
