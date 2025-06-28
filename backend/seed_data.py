from sqlalchemy.orm import Session
from sqlalchemy import text
from core.database import SessionLocal, engine
from models.user import User, FarmerProfile, IndividualProfile, BusinessProfile
from models.product import FarmerProduct, ProductUnitPrice, ItemEnum, UnitEnum, CustomerTypeEnum
from models.order import UnifiedOrder, UnifiedOrderItem, UnifiedPayment, FarmerPayment, OrderStatusEnum, PaymentStatusEnum, PaymentMethodEnum
from models.notification import Notification, DeviceToken, NotificationTypeEnum
from core.security import get_password_hash
from datetime import datetime, timedelta
import random
import json

# Password: testing (for all test users)
DEFAULT_PASSWORD = "testing"

# Mauritius data
MAURITIUS_LOCATIONS = [
    {"street": "Royal Road", "city": "Port Louis", "post_code": "11328"},
    {"street": "Sir William Newton Street", "city": "Port Louis", "post_code": "11302"},
    {"street": "La Chaussée", "city": "Port Louis", "post_code": "11304"},
    {"street": "Coastal Road", "city": "Flic en Flac", "post_code": "90537"},
    {"street": "Royal Road", "city": "Grand Baie", "post_code": "30501"},
    {"street": "Avenue des Cocotiers", "city": "Trou aux Biches", "post_code": "22201"},
    {"street": "St Jean Road", "city": "Quatre Bornes", "post_code": "72201"},
    {"street": "Avenue de la Paix", "city": "Vacoas", "post_code": "73403"},
    {"street": "Royal Road", "city": "Rose Hill", "post_code": "71259"},
    {"street": "Avenue Leconte de Lisle", "city": "Curepipe", "post_code": "74201"},
    {"street": "Coastal Road", "city": "Tamarin", "post_code": "90903"},
    {"street": "Sir Virgil Naz Street", "city": "Mahebourg", "post_code": "50801"},
    {"street": "Avenue des Salines", "city": "Centre de Flacq", "post_code": "40701"},
    {"street": "Avenue Jean Paul II", "city": "Floreal", "post_code": "74001"},
    {"street": "Sir Arthur Raman Street", "city": "Triolet", "post_code": "21201"},
]

MAURITIUS_DISTRICTS = [
    "Port Louis", "Black River", "Flacq", "Grand Port", "Moka",
    "Pamplemousses", "Plaines Wilhems", "Rivière du Rempart", "Savanne"
]

UNIT_ESTIMATES = {
    UnitEnum.KG: 1.0,  # Base unit
    UnitEnum.PIECE: {
        # Estimated kg per piece for different items
        ItemEnum.APPLE: 0.2, ItemEnum.ORANGE: 0.25, ItemEnum.MANGO: 0.4,
        ItemEnum.PINEAPPLE: 1.5, ItemEnum.PAPAYA: 0.8, ItemEnum.COCONUT: 1.2,
        ItemEnum.LEMON: 0.1, ItemEnum.LIME: 0.08, ItemEnum.WATERMELON: 3.0,
        ItemEnum.MELON: 1.5, ItemEnum.CABBAGE: 1.0, ItemEnum.LETTUCE: 0.3,
        ItemEnum.CAULIFLOWER: 0.8, ItemEnum.EGGPLANT: 0.3, ItemEnum.PUMPKIN: 2.0,
    },
    UnitEnum.BUNCH: 0.3,  # Average bunch weight
    UnitEnum.DOZEN: 2.4,  # 12 pieces, estimated average
    UnitEnum.BASKET: 5.0,  # Large basket
}


def get_estimated_weight(item: ItemEnum, unit: UnitEnum) -> float:
    if unit == UnitEnum.KG:
        return 1.0
    elif unit == UnitEnum.PIECE:
        return UNIT_ESTIMATES[UnitEnum.PIECE].get(item, 0.25)
    else:
        return UNIT_ESTIMATES.get(unit, 0.5)


def reset_database(db: Session):
    print("🗑️  Resetting database...")

    try:
        from core.database import Base

        # STEP 1: Get all existing tables from database
        print("  - Scanning existing tables...")
        result = db.execute(text("""
                                 SELECT name
                                 FROM sqlite_master
                                 WHERE type = 'table'
                                   AND name NOT LIKE 'sqlite_%'
                                 ORDER BY name
                                 """))
        existing_tables = [row[0] for row in result]
        print(f"    Found {len(existing_tables)} existing tables")

        # STEP 2: Get all model tables from current models
        model_tables = set(Base.metadata.tables.keys())
        print(f"    Current models define {len(model_tables)} tables")

        # STEP 3: Find orphaned tables (exist in DB but not in models)
        orphaned_tables = set(existing_tables) - model_tables
        if orphaned_tables:
            print(f"  - Removing {len(orphaned_tables)} orphaned tables...")
            for table in orphaned_tables:
                try:
                    db.execute(text(f"DROP TABLE IF EXISTS {table}"))
                    print(f"    ✅ Removed orphaned table: {table}")
                except Exception as e:
                    print(f"    ⚠️  Could not remove {table}: {e}")

        # STEP 4: Drop all remaining tables to ensure clean slate
        print("  - Dropping all remaining tables...")
        Base.metadata.drop_all(bind=engine)

        # STEP 5: Create all tables from current models
        print("  - Creating tables from current models...")
        Base.metadata.create_all(bind=engine)

        # STEP 6: Verify final table structure
        print("  - Verifying final table structure...")
        result = db.execute(text("""
                                 SELECT name
                                 FROM sqlite_master
                                 WHERE type = 'table'
                                   AND name NOT LIKE 'sqlite_%'
                                 ORDER BY name
                                 """))

        final_tables = [row[0] for row in result]
        print(f"    📋 Final database has {len(final_tables)} tables")

        db.commit()
        print("✅ Database cleanup and schema update completed!")

    except Exception as e:
        print(f"❌ Error during database reset: {e}")
        db.rollback()
        raise


def create_test_users(db: Session):
    print("\n👥 Creating main test users...")

    # Main Individual User
    individual_user = User(
        email="individual@test.com",
        hashed_password=get_password_hash(DEFAULT_PASSWORD),
        role="individual"
    )
    db.add(individual_user)
    db.flush()

    location = random.choice(MAURITIUS_LOCATIONS)
    individual_profile = IndividualProfile(
        user_id=individual_user.id,
        first_name="Isfaaq",
        last_name="Emambocus",
        date_of_birth="1997-12-08",
        phone_number="58173526",
        street=location["street"],
        city_town=location["city"],
        post_code=location["post_code"]
    )
    db.add(individual_profile)
    print("Created individual user: individual@test.com")

    # Main Business User
    business_user = User(
        email="business@test.com",
        hashed_password=get_password_hash(DEFAULT_PASSWORD),
        role="business"
    )
    db.add(business_user)
    db.flush()

    location = random.choice(MAURITIUS_LOCATIONS)
    business_profile = BusinessProfile(
        user_id=business_user.id,
        business_name="Tropical Delights Ltd",
        contact_name="Raj Patel",
        phone_number="52987654",
        street=location["street"],
        city_town=location["city"],
        post_code=location["post_code"]
    )
    db.add(business_profile)
    print("Created business user: business@test.com")

    # Main Farmer User (with ALL products)
    farmer_user = User(
        email="farmer@test.com",
        hashed_password=get_password_hash(DEFAULT_PASSWORD),
        role="farmer"
    )
    db.add(farmer_user)
    db.flush()

    farmer_profile = FarmerProfile(
        user_id=farmer_user.id,
        first_name="Kumar",
        last_name="Seebaluck",
        phone_number="59876543",
        district=random.choice(MAURITIUS_DISTRICTS)
    )
    db.add(farmer_profile)
    print("Created farmer user: farmer@test.com")

    return individual_user.id, business_user.id, farmer_user.id


def create_additional_users(db: Session):
    print("\n👥 Creating additional test users...")

    # Additional Individual Users
    individual_names = [
        ("Priya", "Devi"), ("Faizal", "Khodabux"), ("Anita", "Boolell"), ("Yasin", "Patel")
    ]

    for first_name, last_name in individual_names:
        user = User(
            email=f"{first_name.lower()}@test.com",
            hashed_password=get_password_hash(DEFAULT_PASSWORD),
            role="individual"
        )
        db.add(user)
        db.flush()

        location = random.choice(MAURITIUS_LOCATIONS)
        profile = IndividualProfile(
            user_id=user.id,
            first_name=first_name,
            last_name=last_name,
            date_of_birth=f"198{random.randint(5, 9)}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}",
            phone_number=f"5{random.randint(1000000, 9999999)}",
            street=location["street"],
            city_town=location["city"],
            post_code=location["post_code"]
        )
        db.add(profile)
        print(f"Created {first_name.lower()}@test.com")

    # Additional Business Users
    business_data = [
        ("Fresh Market Co", "Lisa", "Chen"),
        ("Halal Foods Ltd", "Ahmed", "Joomun"),
        ("Paradise Foods", "Marie", "Lalanne"),
        ("Ocean View Supplies", "Zara", "Gupta")
    ]

    for business_name, first_name, last_name in business_data:
        user = User(
            email=f"{first_name.lower()}@test.com",
            hashed_password=get_password_hash(DEFAULT_PASSWORD),
            role="business"
        )
        db.add(user)
        db.flush()

        location = random.choice(MAURITIUS_LOCATIONS)
        profile = BusinessProfile(
            user_id=user.id,
            business_name=business_name,
            contact_name=f"{first_name} {last_name}",
            phone_number=f"5{random.randint(1000000, 9999999)}",
            street=location["street"],
            city_town=location["city"],
            post_code=location["post_code"]
        )
        db.add(profile)
        print(f"Created {first_name.lower()}@test.com")

    # Additional Farmer Users
    farmer_names = [
        ("Roshan", "Appadoo"), ("Nisha", "Ramdin"), ("Ibrahim", "Sooklall"), ("Kavitha", "Bheenick")
    ]

    farmer_ids = []
    for first_name, last_name in farmer_names:
        user = User(
            email=f"{first_name.lower()}@test.com",
            hashed_password=get_password_hash(DEFAULT_PASSWORD),
            role="farmer"
        )
        db.add(user)
        db.flush()

        profile = FarmerProfile(
            user_id=user.id,
            first_name=first_name,
            last_name=last_name,
            phone_number=f"5{random.randint(1000000, 9999999)}",
            district=random.choice(MAURITIUS_DISTRICTS)
        )
        db.add(profile)
        farmer_ids.append(user.id)
        print(f"Created {first_name.lower()}@test.com")

    return farmer_ids


def create_product_with_multiple_units(db: Session, farmer_id: int, item: ItemEnum, base_kg_price: float):
    # Create the base product
    product = FarmerProduct(
        farmer_id=farmer_id,
        item=item,
        description=f"Fresh organic {item.value.replace('_', ' ')}, pesticide-free",
        is_active=True,
        harvest_date=datetime.now() - timedelta(days=random.randint(0, 2)),
        expiry_date=datetime.now() + timedelta(days=random.randint(7, 14))
    )
    db.add(product)
    db.flush()

    # Randomly select 1-5 units for this product
    all_units = list(UnitEnum)
    num_units = random.randint(1, len(all_units))
    selected_units = random.sample(all_units, num_units)

    units_created = []

    for unit in selected_units:
        # Calculate price based on estimated weight/count
        weight_factor = get_estimated_weight(item, unit)
        unit_price_individual = round(base_kg_price * weight_factor, 2)
        unit_price_business = round(unit_price_individual * 0.85, 2)  # 15% business discount

        # Random stock quantities for each unit
        base_stock = random.randint(30, 200)
        individual_stock = base_stock
        business_stock = int(base_stock * random.uniform(1.5, 3.0))  # More stock for business

        # Create individual pricing
        individual_unit_price = ProductUnitPrice(
            farmer_product_id=product.id,
            unit=unit,
            customer_type=CustomerTypeEnum.INDIVIDUAL,
            price_per_unit=unit_price_individual,
            quantity_available=individual_stock,
            minimum_order=random.choice([1, 2, 3, 5])
        )
        db.add(individual_unit_price)

        # Create business pricing
        business_unit_price = ProductUnitPrice(
            farmer_product_id=product.id,
            unit=unit,
            customer_type=CustomerTypeEnum.BUSINESS,
            price_per_unit=unit_price_business,
            quantity_available=business_stock,
            minimum_order=random.choice([1, 2, 3, 5])  # Same minimum orders as specified
        )
        db.add(business_unit_price)

        units_created.append({
            'unit': unit.value,
            'individual_price': unit_price_individual,
            'business_price': unit_price_business,
            'individual_stock': individual_stock,
            'business_stock': business_stock
        })

    return product, units_created


def create_all_products(db: Session, farmer_id: int):
    print(f"Creating ALL products with multiple units for main farmer...")

    # Base prices per kg for different items
    base_prices = {
        # FRUITS
        ItemEnum.APPLE: 450.0, ItemEnum.BANANA: 300.0, ItemEnum.ORANGE: 350.0,
        ItemEnum.MANGO: 500.0, ItemEnum.PINEAPPLE: 200.0, ItemEnum.PAPAYA: 300.0,
        ItemEnum.GUAVA: 200.0, ItemEnum.LYCHEE: 600.0, ItemEnum.COCONUT: 80.0,
        ItemEnum.LEMON: 400.0, ItemEnum.LIME: 350.0, ItemEnum.WATERMELON: 150.0,
        ItemEnum.MELON: 250.0, ItemEnum.GRAPES: 800.0, ItemEnum.STRAWBERRY: 1200.0,

        # VEGETABLES
        ItemEnum.TOMATO: 350.0, ItemEnum.POTATO: 200.0, ItemEnum.ONION: 300.0,
        ItemEnum.CARROT: 280.0, ItemEnum.CABBAGE: 150.0, ItemEnum.LETTUCE: 500.0,
        ItemEnum.SPINACH: 400.0, ItemEnum.BROCCOLI: 400.0, ItemEnum.CAULIFLOWER: 350.0,
        ItemEnum.BELL_PEPPER: 450.0, ItemEnum.CHILI: 800.0, ItemEnum.CUCUMBER: 180.0,
        ItemEnum.EGGPLANT: 220.0, ItemEnum.OKRA: 300.0, ItemEnum.GREEN_BEANS: 250.0,
        ItemEnum.PUMPKIN: 120.0, ItemEnum.BEETROOT: 300.0, ItemEnum.RADISH: 200.0,
        ItemEnum.GINGER: 600.0, ItemEnum.GARLIC: 800.0,
    }

    products_created = 0
    total_units_created = 0

    for item, base_price in base_prices.items():
        product, units_info = create_product_with_multiple_units(db, farmer_id, item, base_price)
        products_created += 1
        total_units_created += len(units_info)

        # Print summary for some products
        if products_created <= 5:
            units_summary = ", ".join([f"{u['unit']} (₹{u['individual_price']:.2f})" for u in units_info])
            print(f"  ✅ {item.value}: {len(units_info)} units - {units_summary}")

    print(f"  📊 Created {products_created} products with {total_units_created} total unit variations")


def create_farmer_products(db: Session, farmer_id: int, farmer_name: str):
    # Select random items for this farmer
    all_items = list(ItemEnum)
    num_items = random.randint(8, 15)
    selected_items = random.sample(all_items, num_items)

    print(f"Creating {num_items} products for {farmer_name}...")

    products_created = 0
    total_units_created = 0

    for item in selected_items:
        # Random base price
        base_price = random.randint(80, 800)

        product, units_info = create_product_with_multiple_units(db, farmer_id, item, base_price)
        products_created += 1
        total_units_created += len(units_info)

    print(f"  📊 Created {products_created} products with {total_units_created} total unit variations for {farmer_name}")


def create_sample_orders_and_notifications(db: Session, individual_id: int, business_id: int, farmer_id: int):
    print("\n📦 Creating sample orders and notifications...")

    # Create an order for individual user
    order1 = UnifiedOrder(
        order_number=f"ORD-{datetime.now().strftime('%Y%m%d')}-001",
        customer_id=individual_id,
        status=OrderStatusEnum.DELIVERED,
        total_amount=1250.50,
        delivery_fee=100.0,
        final_amount=1350.50,
        customer_name="Isfaaq Emambocus",
        customer_phone="58173526",
        customer_email="individual@test.com",
        delivery_address="Royal Road, Port Louis 11328",
        delivery_notes="Call when arriving",
        created_at=datetime.now() - timedelta(days=3),
        delivered_at=datetime.now() - timedelta(days=1)
    )
    db.add(order1)
    db.flush()

    # Set farmer status using the new JSON field
    delivery_time = (datetime.now() - timedelta(days=1)).isoformat()
    order1.update_farmer_status(farmer_id, "delivered", delivery_time)

    # Create order items
    order_item1 = UnifiedOrderItem(
        order_id=order1.id,
        farmer_id=farmer_id,
        farmer_product_id=1,  # Assuming first product
        item_name=ItemEnum.APPLE,
        unit="kg",
        unit_price=450.0,
        quantity=2.0,
        total_price=900.0,
        product_description="Fresh organic apples"
    )
    db.add(order_item1)

    order_item2 = UnifiedOrderItem(
        order_id=order1.id,
        farmer_id=farmer_id,
        farmer_product_id=2,  # Assuming second product
        item_name=ItemEnum.BANANA,
        unit="dozen",
        unit_price=180.0,
        quantity=2.0,
        total_price=360.0,
        product_description="Fresh bananas"
    )
    db.add(order_item2)

    # Create payment
    payment1 = UnifiedPayment(
        order_id=order1.id,
        payment_method=PaymentMethodEnum.STRIPE_CARD,
        status=PaymentStatusEnum.SUCCESSFUL,
        amount=1350.50,
        currency="MUR",
        completed_at=datetime.now() - timedelta(days=1)
    )
    db.add(payment1)

    # Create farmer payment
    farmer_payment1 = FarmerPayment(
        order_id=order1.id,
        farmer_id=farmer_id,
        gross_amount=1250.50,
        platform_fee=125.05,
        net_amount=1125.45,
        platform_fee_percentage=10.0,
        payment_status="paid",
        paid_at=datetime.now() - timedelta(days=1)
    )
    db.add(farmer_payment1)

    # Create notifications for farmer (order received)
    notification1 = Notification(
        user_id=farmer_id,
        order_id=order1.id,
        type=NotificationTypeEnum.ORDER_CREATED,
        title="New Order Received!",
        message=f"Order {order1.order_number} - 2 items, Rs 1250.50",
        data=json.dumps({
            "order_number": order1.order_number,
            "item_count": 2,
            "amount": 1250.50
        }),
        is_read=True,
        is_sent=True,
        sent_at=datetime.now() - timedelta(days=3),
        created_at=datetime.now() - timedelta(days=3)
    )
    db.add(notification1)

    # Create notification for customer (order delivered)
    notification2 = Notification(
        user_id=individual_id,
        order_id=order1.id,
        farmer_id=farmer_id,
        type=NotificationTypeEnum.ORDER_DELIVERED,
        title="Order Delivered!",
        message="Your order has been successfully delivered",
        data=json.dumps({
            "order_number": order1.order_number,
            "farmer_name": "Kumar Seebaluck"
        }),
        is_read=False,
        is_sent=True,
        sent_at=datetime.now() - timedelta(days=1),
        created_at=datetime.now() - timedelta(days=1)
    )
    db.add(notification2)

    # Create a business order
    order2 = UnifiedOrder(
        order_number=f"ORD-{datetime.now().strftime('%Y%m%d')}-002",
        customer_id=business_id,
        status=OrderStatusEnum.PROCESSING,
        total_amount=5850.00,
        delivery_fee=200.0,
        final_amount=6050.00,
        customer_name="Raj Patel",
        customer_phone="52987654",
        customer_email="business@test.com",
        delivery_address="Sir William Newton Street, Port Louis 11302",
        delivery_notes="Business delivery - loading dock access",
        created_at=datetime.now() - timedelta(days=1)
    )
    db.add(order2)
    db.flush()

    # Set farmer status for business order using the new JSON field
    order2.update_farmer_status(farmer_id, "processing")

    # Create business order items
    order_item3 = UnifiedOrderItem(
        order_id=order2.id,
        farmer_id=farmer_id,
        farmer_product_id=3,
        item_name=ItemEnum.TOMATO,
        unit="kg",
        unit_price="320.0",
        quantity=15.0,
        total_price=4800.0,
        product_description="Fresh organic tomatoes for business"
    )
    db.add(order_item3)

    order_item4 = UnifiedOrderItem(
        order_id=order2.id,
        farmer_id=farmer_id,
        farmer_product_id=4,
        item_name=ItemEnum.ONION,
        unit="kg",
        unit_price="270.0",
        quantity=5.0,
        total_price=1350.0,
        product_description="Fresh onions for business"
    )
    db.add(order_item4)

    # Create business payment
    payment2 = UnifiedPayment(
        order_id=order2.id,
        payment_method=PaymentMethodEnum.STRIPE_APPLE_PAY,
        status=PaymentStatusEnum.PENDING,
        amount=6050.00,
        currency="MUR"
    )
    db.add(payment2)

    # Create business farmer payment
    farmer_payment2 = FarmerPayment(
        order_id=order2.id,
        farmer_id=farmer_id,
        gross_amount=6150.00,
        platform_fee=615.00,
        net_amount=5535.00,
        platform_fee_percentage=10.0,
        payment_status="pending"
    )
    db.add(farmer_payment2)

    print("✅ Created sample orders, payments, and notifications")


def seed_database():
    print("=" * 60)
    print("🏝️ Starting FarmLink Mauritius Testing Database Setup...")
    print("=" * 60)

    # Create database session
    db = SessionLocal()
    try:
        # Reset database
        reset_database(db)

        print("\n👥 Creating main test users...")
        individual_id, business_id, farmer_id = create_test_users(db)

        # Create additional users
        additional_farmer_ids = create_additional_users(db)

        print(f"\n🥕 Creating ALL products with multiple units for main farmer (ID: {farmer_id})...")
        create_all_products(db, farmer_id)

        print(f"\n🌱 Creating products for additional farmers...")
        farmer_names = ["roshan", "nisha", "ibrahim", "kavitha"]
        for i, add_farmer_id in enumerate(additional_farmer_ids):
            create_farmer_products(db, add_farmer_id, farmer_names[i])

        # Create sample orders and notifications for main users
        create_sample_orders_and_notifications(db, individual_id, business_id, farmer_id)

        db.commit()
        print("\n" + "=" * 60)
        print("✅ Mauritius Testing Database Setup Completed!")
        print("=" * 60)
        print(f"🔑 Password for all users: {DEFAULT_PASSWORD}")
        print("=" * 60)
        print("🧪 Main test accounts:")
        print("  👤 Individual: individual@test.com (Isfaaq Emambocus)")
        print("  🏢 Business: business@test.com (Tropical Delights Ltd)")
        print("  🚜 Farmer: farmer@test.com (Kumar Seebaluck)")
        print("=" * 60)
        print("📋 Additional test accounts:")
        print("  👤 Individual: priya@test.com, faizal@test.com, anita@test.com, yasin@test.com")
        print("  🏢 Business: lisa@test.com, ahmed@test.com, marie@test.com, zara@test.com")
        print("  🚜 Farmer: roshan@test.com, nisha@test.com, ibrahim@test.com, kavitha@test.com")
        print("=" * 60)
        print("🎯 Ready for Testing!")
        print("📊 Products now have 1-5 random units each with consistent pricing!")

    except Exception as e:
        print(f"\n❌ Error during seeding: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()