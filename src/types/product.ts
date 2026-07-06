export interface BaseProduct {
    id: string;
    name: string;
    category: string;
    price: number;
    stock: number;
    image: string;
    images?: string[]; // Multiple images for gallery
    description: string;
    rating: number;
}

export interface Product extends BaseProduct {
    soldCount: number;
}

export interface BuyerProduct extends BaseProduct {
    storeName: string;
    storeId?: string;
    /** auth.users id of the store owner */
    sellerId?: string;
    storeAvatar?: string;
    storeRating?: number;
    storeFollowers?: number;
}
