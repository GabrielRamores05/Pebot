package com.cafeos.tablet.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MenuImportParserTest {
    @Test
    fun parses_simple_menu_json() {
        val json = """
            {
              "categories": [
                {"name": "Coffee", "items": ["Americano", "Spanish Latte"]},
                {"name": "Non-Coffee", "items": ["Strawberry Milk"]}
              ],
              "addOns": [
                {"name": "Vanilla Foam", "priceDelta": 20.0},
                {"name": "Seasalt Foam", "priceDelta": 20.0}
              ]
            }
        """.trimIndent()

        val parsed = MenuImportParser.parse(json)

        assertTrue(parsed != null)
        assertEquals(2, parsed!!.categories.size)
        assertEquals("Coffee", parsed.categories[0].name)
        assertEquals(2, parsed.categories[0].items.size)
        assertEquals(2, parsed.addOns.size)
        assertEquals("Vanilla Foam", parsed.addOns[0].name)
    }

    @Test
    fun parses_pebot_tablet_product_import_json() {
        val json = """
            {
              "version": 1,
              "ingredients": [
                { "name": "Espresso", "category": "Coffee Base", "baseUnit": "shots", "currentStock": 200, "minStock": 30, "costPerUnit": 12.0 },
                { "name": "Water", "category": "Beverage Base", "baseUnit": "ml", "currentStock": 5000, "minStock": 500, "costPerUnit": 0.5 }
              ],
              "products": [
                {
                  "name": "Americano",
                  "category": "Coffee",
                  "price": 120.0,
                  "available": true,
                  "stationType": "coffee",
                  "recipe": [
                    { "ingredient": "Espresso", "quantity": 2, "unit": "shots" },
                    { "ingredient": "Water", "quantity": 150, "unit": "ml" }
                  ]
                }
              ]
            }
        """.trimIndent()

        val parsed = MenuImportParser.parse(json)

        assertNotNull(parsed)
        assertEquals(2, parsed!!.ingredients.size)
        assertEquals("Espresso", parsed.ingredients[0].name)
        assertEquals(1, parsed.products.size)
        assertEquals("Americano", parsed.products[0].name)
        assertEquals("Coffee", parsed.products[0].category)
        assertEquals(2, parsed.products[0].recipe.size)
    }
}
