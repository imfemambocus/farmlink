# seed_data.py - UNIFIED SYSTEM ONLY
from sqlalchemy.orm import Session
from sqlalchemy import text
from core.database import SessionLocal, engine
from models.user import User, FarmerProfile, IndividualProfile, BusinessProfile
from models.product import FarmerProduct, ProductUnitPrice, ItemEnum, UnitEnum, CustomerTypeEnum
from models.order import (
    Cart, CartItem,
    UnifiedOrder, UnifiedOrderItem, UnifiedPayment, FarmerPayment,
    OrderStatusEnum, PaymentStatusEnum, PaymentMethodEnum
)
from core.security import get_password_hash
import random
from datetime import datetime, timedelta
from decimal import Decimal
import uuid

# Password: farmlink123 (for all users)
DEFAULT_PASSWORD = "farmlink123"


def reset_database(db: Session):
    """Reset database and create all tables with updated schema"""
    print("🗑️  Resetting database...")

    try:
        # Import Base to access metadata
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

        # Show order/cart/payment tables specifically
        relevant_tables = [table for table in final_tables if
                           any(keyword in table.lower() for keyword in ['order', 'cart', 'payment'])]
        if relevant_tables:
            print("    🎯 Order/Cart/Payment system tables:")
            for table in relevant_tables:
                print(f"      ✅ {table}")

        db.commit()
        print("✅ Database cleanup and schema update completed!")

    except Exception as e:
        print(f"❌ Error during database reset: {e}")
        db.rollback()
        raise


def create_sample_users(db: Session):
    """Create sample users with profiles"""

    # Sample farmers
    farmers_data = [
        {
            "email": "james.farmer@gmail.com",
            "first_name": "James",
            "last_name": "Farmer",
            "phone_number": "+94771234567",
            "district": "Colombo"
        },
        {
            "email": "emily.farmer@gmail.com",
            "first_name": "Emily",
            "last_name": "Farmer",
            "phone_number": "+94772345678",
            "district": "Kandy"
        },
        {
            "email": "william.farmer@gmail.com",
            "first_name": "William",
            "last_name": "Farmer",
            "phone_number": "+94773456789",
            "district": "Galle"
        },
        {
            "email": "olivia.farmer@gmail.com",
            "first_name": "Olivia",
            "last_name": "Farmer",
            "phone_number": "+94774567890",
            "district": "Matara"
        },
        {
            "email": "benjamin.farmer@gmail.com",
            "first_name": "Benjamin",
            "last_name": "Farmer",
            "phone_number": "+94775678901",
            "district": "Jaffna"
        }
    ]

    for farmer_data in farmers_data:
        # Create user
        user = User(
            email=farmer_data["email"],
            hashed_password=get_password_hash(DEFAULT_PASSWORD),
            role="farmer"
        )
        db.add(user)
        db.flush()  # Get the user ID

        # Create farmer profile
        profile = FarmerProfile(
            user_id=user.id,
            first_name=farmer_data["first_name"],
            last_name=farmer_data["last_name"],
            phone_number=farmer_data["phone_number"],
            district=farmer_data["district"]
        )
        db.add(profile)
        print(f"Created farmer: {farmer_data['first_name']} {farmer_data['last_name']}")

    # Sample individuals
    individuals_data = [
        {
            "email": "alex.thompson@gmail.com",
            "first_name": "Alex",
            "last_name": "Thompson",
            "date_of_birth": "1990-05-15",
            "phone_number": "+94776789012",
            "street": "123 Main Street",
            "city_town": "Colombo",
            "post_code": "00100"
        },
        {
            "email": "jessica.miller@gmail.com",
            "first_name": "Jessica",
            "last_name": "Miller",
            "date_of_birth": "1985-08-22",
            "phone_number": "+94777890123",
            "street": "456 Queen Street",
            "city_town": "Kandy",
            "post_code": "20000"
        },
        {
            "email": "daniel.brown@gmail.com",
            "first_name": "Daniel",
            "last_name": "Brown",
            "date_of_birth": "1992-12-03",
            "phone_number": "+94778901234",
            "street": "789 Lake Road",
            "city_town": "Galle",
            "post_code": "80000"
        }
    ]

    for individual_data in individuals_data:
        user = User(
            email=individual_data["email"],
            hashed_password=get_password_hash(DEFAULT_PASSWORD),
            role="individual"
        )
        db.add(user)
        db.flush()

        profile = IndividualProfile(
            user_id=user.id,
            first_name=individual_data["first_name"],
            last_name=individual_data["last_name"],
            date_of_birth=individual_data["date_of_birth"],
            phone_number=individual_data["phone_number"],
            street=individual_data["street"],
            city_town=individual_data["city_town"],
            post_code=individual_data["post_code"]
        )
        db.add(profile)
        print(f"Created individual: {individual_data['first_name']} {individual_data['last_name']}")

    # Sample businesses
    businesses_data = [
        {
            "email": "greenmart.business@gmail.com",
            "business_name": "Green Mart Supermarket",
            "contact_name": "David Business",
            "phone_number": "+94779012345",
            "street": "321 Commercial Street",
            "city_town": "Colombo",
            "post_code": "00200"
        },
        {
            "email": "freshfoods.business@gmail.com",
            "business_name": "Fresh Foods Distribution",
            "contact_name": "Sophie Business",
            "phone_number": "+94770123456",
            "street": "654 Industrial Road",
            "city_town": "Kandy",
            "post_code": "20100"
        },
        {
            "email": "organicplus.business@gmail.com",
            "business_name": "Organic Plus Store",
            "contact_name": "Michael Business",
            "phone_number": "+94771234567",
            "street": "987 Market Lane",
            "city_town": "Negombo",
            "post_code": "11500"
        }
    ]

    for business_data in businesses_data:
        user = User(
            email=business_data["email"],
            hashed_password=get_password_hash(DEFAULT_PASSWORD),
            role="business"
        )
        db.add(user)
        db.flush()

        profile = BusinessProfile(
            user_id=user.id,
            business_name=business_data["business_name"],
            contact_name=business_data["contact_name"],
            phone_number=business_data["phone_number"],
            street=business_data["street"],
            city_town=business_data["city_town"],
            post_code=business_data["post_code"]
        )
        db.add(profile)
        print(f"Created business: {business_data['business_name']}")


def create_sample_products(db: Session):
    """Create sample products for farmers with individual and business pricing"""

    farmers = db.query(User).filter(User.role == "farmer").all()
    if not farmers:
        print("No farmers found. Create farmers first.")
        return

    # Simplified product templates with realistic Sri Lankan pricing
    product_templates = [
        {
            "item": ItemEnum.TOMATO,
            "description": "Fresh organic tomatoes, pesticide-free, hand-picked daily",
            "pricing": [
                {
                    "unit": UnitEnum.KG,
                    "individual": {"price": 350.0, "quantity": 100, "minimum": 1},
                    "business": {"price": 320.0, "quantity": 500, "minimum": 25}
                }
            ]
        },
        {
            "item": ItemEnum.CARROT,
            "description": "Premium highland carrots, sweet and crunchy",
            "pricing": [
                {
                    "unit": UnitEnum.KG,
                    "individual": {"price": 280.0, "quantity": 80, "minimum": 2},
                    "business": {"price": 250.0, "quantity": 400, "minimum": 25}
                }
            ]
        },
        {
            "item": ItemEnum.BANANA,
            "description": "Sweet Cavendish bananas, perfectly ripened",
            "pricing": [
                {
                    "unit": UnitEnum.DOZEN,
                    "individual": {"price": 180.0, "quantity": 40, "minimum": 1},
                    "business": {"price": 160.0, "quantity": 200, "minimum": 25}
                }
            ]
        },
        {
            "item": ItemEnum.POTATO,
            "description": "High-quality potatoes, perfect for cooking",
            "pricing": [
                {
                    "unit": UnitEnum.KG,
                    "individual": {"price": 200.0, "quantity": 150, "minimum": 5},
                    "business": {"price": 180.0, "quantity": 1000, "minimum": 50}
                }
            ]
        },
        {
            "item": ItemEnum.ONION,
            "description": "Fresh red onions, strong flavor and aroma",
            "pricing": [
                {
                    "unit": UnitEnum.KG,
                    "individual": {"price": 300.0, "quantity": 120, "minimum": 2},
                    "business": {"price": 270.0, "quantity": 600, "minimum": 25}
                }
            ]
        },
        {
            "item": ItemEnum.CABBAGE,
            "description": "Fresh green cabbage, crispy and nutritious",
            "pricing": [
                {
                    "unit": UnitEnum.PIECE,
                    "individual": {"price": 150.0, "quantity": 50, "minimum": 1},
                    "business": {"price": 130.0, "quantity": 200, "minimum": 25}
                }
            ]
        },
        {
            "item": ItemEnum.MANGO,
            "description": "Sweet tropical mangoes, naturally ripened",
            "pricing": [
                {
                    "unit": UnitEnum.KG,
                    "individual": {"price": 500.0, "quantity": 60, "minimum": 1},
                    "business": {"price": 450.0, "quantity": 300, "minimum": 25}
                }
            ]
        },
        {
            "item": ItemEnum.COCONUT,
            "description": "Fresh coconuts, perfect for milk and oil",
            "pricing": [
                {
                    "unit": UnitEnum.PIECE,
                    "individual": {"price": 80.0, "quantity": 100, "minimum": 3},
                    "business": {"price": 70.0, "quantity": 500, "minimum": 50}
                }
            ]
        }
    ]

    for farmer in farmers:
        print(f"Creating products for farmer: {farmer.farmer_profile.first_name} {farmer.farmer_profile.last_name}")

        # Each farmer gets 3-5 products
        selected_products = random.sample(product_templates, random.randint(3, 5))

        for product_data in selected_products:
            # Create product with slight price variation per farmer
            price_variation = random.uniform(0.9, 1.1)  # ±10% price variation

            product = FarmerProduct(
                farmer_id=farmer.id,
                item=product_data["item"],
                description=product_data["description"],
                is_active=True,
                harvest_date=datetime.now() - timedelta(days=random.randint(1, 5)),
                expiry_date=datetime.now() + timedelta(days=random.randint(5, 15))
            )
            db.add(product)
            db.flush()

            # Add individual and business pricing
            for pricing_data in product_data["pricing"]:
                # Individual pricing
                individual_unit_price = ProductUnitPrice(
                    farmer_product_id=product.id,
                    unit=pricing_data["unit"],
                    customer_type=CustomerTypeEnum.INDIVIDUAL,
                    price_per_unit=round(pricing_data["individual"]["price"] * price_variation, 2),
                    quantity_available=pricing_data["individual"]["quantity"] + random.randint(-10, 20),
                    minimum_order=pricing_data["individual"]["minimum"]
                )
                db.add(individual_unit_price)

                # Business pricing (always lower than individual)
                business_unit_price = ProductUnitPrice(
                    farmer_product_id=product.id,
                    unit=pricing_data["unit"],
                    customer_type=CustomerTypeEnum.BUSINESS,
                    price_per_unit=round(pricing_data["business"]["price"] * price_variation, 2),
                    quantity_available=pricing_data["business"]["quantity"] + random.randint(-50, 100),
                    minimum_order=pricing_data["business"]["minimum"]
                )
                db.add(business_unit_price)

            print(f"  + Created {product_data['item'].value} (individual & business pricing)")


def create_sample_cart_items(db: Session):
    """Create sample cart items for testing checkout flow"""
    print("\n🛒 Creating sample cart items...")

    # Get customers for cart testing
    customers = db.query(User).filter(User.role.in_(["individual", "business"])).limit(3).all()
    unit_prices = db.query(ProductUnitPrice).all()

    if not customers or not unit_prices:
        print("No customers or products found for cart creation")
        return

    for customer in customers:
        # Create cart
        cart = Cart(user_id=customer.id)
        db.add(cart)
        db.flush()

        # Filter prices by customer type
        customer_type = CustomerTypeEnum.INDIVIDUAL if customer.role == "individual" else CustomerTypeEnum.BUSINESS
        suitable_prices = [up for up in unit_prices if up.customer_type == customer_type]

        # Add 3-5 items from different farmers to test multi-farmer checkout
        selected_items = random.sample(suitable_prices, min(5, len(suitable_prices)))

        for unit_price in selected_items:
            # Ensure we have enough stock
            if unit_price.quantity_available < unit_price.minimum_order:
                continue

            quantity = unit_price.minimum_order
            if customer.role == "business":
                quantity = max(25, unit_price.minimum_order)  # Business minimum

            # Don't exceed available stock
            quantity = min(quantity, unit_price.quantity_available)

            cart_item = CartItem(
                cart_id=cart.id,
                farmer_product_id=unit_price.farmer_product_id,
                unit_price_id=unit_price.id,
                quantity=quantity,
                unit_price_snapshot=Decimal(str(unit_price.price_per_unit))
            )
            db.add(cart_item)

        customer_name = ""
        if customer.role == "individual":
            customer_name = f"{customer.individual_profile.first_name} {customer.individual_profile.last_name}"
        else:
            customer_name = customer.business_profile.contact_name

        print(f"  + Created cart for {customer_name} with {len(selected_items)} items")


def create_sample_unified_orders(db: Session):
    """Create sample unified orders for testing revenue distribution"""
    print("\n📦 Creating sample unified orders...")

    customers = db.query(User).filter(User.role.in_(["individual", "business"])).limit(2).all()
    farmers = db.query(User).filter(User.role == "farmer").all()

    if not customers or not farmers:
        print("No customers or farmers found")
        return

    # Create different order statuses for variety
    order_statuses = [OrderStatusEnum.CONFIRMED, OrderStatusEnum.PROCESSING, OrderStatusEnum.OUT_FOR_DELIVERY,
                      OrderStatusEnum.DELIVERED]

    for i, customer in enumerate(customers):
        # Get customer info
        if customer.role == "individual":
            customer_name = f"{customer.individual_profile.first_name} {customer.individual_profile.last_name}"
            customer_phone = customer.individual_profile.phone_number
            delivery_address = f"{customer.individual_profile.street}, {customer.individual_profile.city_town}, {customer.individual_profile.post_code}"
        else:
            customer_name = customer.business_profile.contact_name
            customer_phone = customer.business_profile.phone_number
            delivery_address = f"{customer.business_profile.street}, {customer.business_profile.city_town}, {customer.business_profile.post_code}"

        # Generate realistic order number
        order_date = datetime.now() - timedelta(days=random.randint(1, 7))
        order_number = f"FL-{order_date.strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"

        # Select 2-3 farmers for this order (multi-farmer testing)
        selected_farmers = random.sample(farmers, random.randint(2, 3))

        total_amount = Decimal('0')
        farmer_totals = {}
        order_items_data = []

        for farmer in selected_farmers:
            farmer_products = db.query(FarmerProduct).filter(
                FarmerProduct.farmer_id == farmer.id,
                FarmerProduct.is_active == True
            ).limit(2).all()

            farmer_total = Decimal('0')

            for product in farmer_products:
                customer_type = CustomerTypeEnum.INDIVIDUAL if customer.role == "individual" else CustomerTypeEnum.BUSINESS
                unit_prices = [up for up in product.unit_prices if up.customer_type == customer_type]

                if not unit_prices:
                    continue

                unit_price = unit_prices[0]  # Take first available
                quantity = unit_price.minimum_order

                if customer.role == "business":
                    quantity = max(25, unit_price.minimum_order)

                # Ensure we don't exceed available stock
                quantity = min(quantity, unit_price.quantity_available)

                item_total = Decimal(str(unit_price.price_per_unit)) * Decimal(str(quantity))
                total_amount += item_total
                farmer_total += item_total

                order_items_data.append({
                    'farmer_id': farmer.id,
                    'farmer_product_id': product.id,
                    'item_name': product.item.value.replace('_', ' ').title(),
                    'unit': unit_price.unit.value,
                    'unit_price': Decimal(str(unit_price.price_per_unit)),
                    'quantity': quantity,
                    'total_price': item_total,
                    'product_description': product.description
                })

            if farmer_total > 0:
                farmer_totals[farmer.id] = farmer_total

        if not order_items_data:
            continue

        delivery_fee = Decimal('50.00')
        final_amount = total_amount + delivery_fee

        # Create unified order with varying status
        status = order_statuses[i % len(order_statuses)]

        unified_order = UnifiedOrder(
            order_number=order_number,
            customer_id=customer.id,
            status=status,
            total_amount=total_amount,
            delivery_fee=delivery_fee,
            final_amount=final_amount,
            customer_name=customer_name,
            customer_phone=customer_phone,
            customer_email=customer.email,
            delivery_address=delivery_address,
            delivery_notes="Sample unified order demonstrating multi-farmer revenue distribution",
            created_at=order_date,
            delivered_at=order_date + timedelta(days=3) if status == OrderStatusEnum.DELIVERED else None
        )
        db.add(unified_order)
        db.flush()

        # Create order items
        for item_data in order_items_data:
            unified_order_item = UnifiedOrderItem(
                order_id=unified_order.id,
                farmer_id=item_data['farmer_id'],
                farmer_product_id=item_data['farmer_product_id'],
                item_name=item_data['item_name'],
                unit=item_data['unit'],
                unit_price=item_data['unit_price'],
                quantity=item_data['quantity'],
                total_price=item_data['total_price'],
                product_description=item_data['product_description']
            )
            db.add(unified_order_item)

        # Create payment record
        payment_status = PaymentStatusEnum.SUCCESSFUL if status in [OrderStatusEnum.DELIVERED,
                                                                    OrderStatusEnum.OUT_FOR_DELIVERY] else PaymentStatusEnum.PENDING

        unified_payment = UnifiedPayment(
            order_id=unified_order.id,
            payment_method=PaymentMethodEnum.STRIPE_CARD,
            status=payment_status,
            amount=final_amount,
            stripe_payment_intent_id=f"pi_test_{str(uuid.uuid4())[:16]}",
            completed_at=order_date + timedelta(minutes=5) if payment_status == PaymentStatusEnum.SUCCESSFUL else None
        )
        db.add(unified_payment)

        # Create farmer payment records (showing revenue distribution)
        for farmer_id, gross_amount in farmer_totals.items():
            platform_fee = gross_amount * Decimal('0.10')  # FarmLink's 10% commission
            net_amount = gross_amount - platform_fee

            # Payment status based on order status
            farmer_payment_status = "paid" if status == OrderStatusEnum.DELIVERED else "pending"
            paid_date = order_date + timedelta(days=7) if farmer_payment_status == "paid" else None

            farmer_payment = FarmerPayment(
                order_id=unified_order.id,
                farmer_id=farmer_id,
                gross_amount=gross_amount,
                platform_fee=platform_fee,
                net_amount=net_amount,
                platform_fee_percentage=10.0,
                payment_status=farmer_payment_status,
                paid_at=paid_date
            )
            db.add(farmer_payment)

        print(
            f"  + Created unified order {order_number} ({status.value}) - Rs {final_amount} across {len(farmer_totals)} farmers")


def seed_database():
    """Main seeding function for unified system"""
    print("=" * 60)
    print("🌱 Starting FarmLink Unified System Database Seeding...")
    print("=" * 60)

    # Create database session
    db = SessionLocal()
    try:
        # Reset database - automatically removes orphaned tables
        reset_database(db)

        print("\n👥 Creating sample users...")
        create_sample_users(db)

        print("\n🥕 Creating sample products with dual pricing...")
        create_sample_products(db)

        print("\n🛒 Creating sample cart items...")
        create_sample_cart_items(db)

        print("\n📦 Creating sample unified orders...")
        create_sample_unified_orders(db)

        db.commit()
        print("\n" + "=" * 60)
        print("✅ Unified System Database Seeding Completed Successfully!")
        print("=" * 60)
        print(f"🔑 Default password for all users: {DEFAULT_PASSWORD}")
        print("=" * 60)
        print("👥 Test accounts:")
        print("  📱 Individual Customer: alex.thompson@gmail.com")
        print("  🏢 Business Customer: greenmart.business@gmail.com")
        print("  🚜 Farmer: james.farmer@gmail.com")
        print("=" * 60)
        print("🎯 Features to test:")
        print("  ✅ Multi-farmer cart checkout")
        print("  ✅ Stripe payment integration")
        print("  ✅ Revenue distribution (10% FarmLink commission)")
        print("  ✅ Individual vs Business pricing")
        print("  ✅ Order status tracking")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ Error during seeding: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()