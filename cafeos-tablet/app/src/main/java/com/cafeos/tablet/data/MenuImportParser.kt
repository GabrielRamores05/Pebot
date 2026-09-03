package com.cafeos.tablet.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

object MenuImportParser {
    @Serializable
    data class SimpleMenuData(
        val categories: List<CategoryImport> = emptyList(),
        val products: List<ProductImport> = emptyList(),
        val addOns: List<AddOnImport> = emptyList(),
        val ingredients: List<IngredientImport> = emptyList()
    )

    @Serializable
    data class CategoryImport(
        val name: String,
        val items: List<String> = emptyList()
    )

    @Serializable
    data class IngredientImport(
        val name: String,
        val category: String = "General",
        val baseUnit: String = "pcs",
        val currentStock: Double = 0.0,
        val minStock: Double = 0.0,
        val costPerUnit: Double = 0.0
    )

    @Serializable
    data class ProductImport(
        val name: String,
        val category: String? = null,
        val price: Double = 0.0,
        val available: Boolean = true,
        val stationType: String = "general",
        val ingredients: List<ProductIngredientImport> = emptyList(),
        val recipe: List<ProductIngredientImport> = emptyList()
    )

    @Serializable
    data class ProductIngredientImport(
        val ingredient: String? = null,
        val name: String? = null,
        val quantity: Double = 0.0,
        val unit: String = "g",
        val required: Boolean = true
    )

    @Serializable
    data class AddOnImport(
        val name: String,
        val priceDelta: Double = 0.0
    )

    fun parse(jsonText: String): SimpleMenuData? {
        val json = Json { ignoreUnknownKeys = true }

        val root = try {
            json.parseToJsonElement(jsonText).jsonObject
        } catch (_: Exception) {
            return null
        }

        val categories = root["categories"]?.jsonArray.orEmpty().mapNotNull { element ->
            val obj = element.jsonObject
            val name = obj["name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
            val items = obj["items"]?.jsonArray.orEmpty().map { it.jsonPrimitive.content }
            CategoryImport(name, items)
        }

        val ingredients = root["ingredients"]?.jsonArray.orEmpty().mapNotNull { element ->
            val obj = element.jsonObject
            val name = obj["name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
            val category = obj["category"]?.jsonPrimitive?.contentOrNull ?: "General"
            val baseUnit = obj["baseUnit"]?.jsonPrimitive?.contentOrNull ?: "pcs"
            val currentStock = obj["currentStock"]?.jsonPrimitive?.content?.toDoubleOrNull() ?: 0.0
            val minStock = obj["minStock"]?.jsonPrimitive?.content?.toDoubleOrNull() ?: 0.0
            val costPerUnit = obj["costPerUnit"]?.jsonPrimitive?.content?.toDoubleOrNull() ?: 0.0
            IngredientImport(name, category, baseUnit, currentStock, minStock, costPerUnit)
        }

        val products = root["products"]?.jsonArray.orEmpty().mapNotNull { element ->
            val obj = element.jsonObject
            val name = obj["name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
            val category = obj["category"]?.jsonPrimitive?.contentOrNull
            val price = obj["price"]?.jsonPrimitive?.content?.toDoubleOrNull() ?: 0.0
            val available = obj["available"]?.jsonPrimitive?.contentOrNull?.toBooleanStrictOrNull() ?: true
            val stationType = obj["stationType"]?.jsonPrimitive?.contentOrNull ?: "general"

            val ingredientEntries = obj["ingredients"]?.jsonArray.orEmpty().mapNotNull { ingredientElement ->
                val ingredientObj = ingredientElement.jsonObject
                val ingredientName = ingredientObj["ingredient"]?.jsonPrimitive?.contentOrNull ?: ingredientObj["name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                val quantity = ingredientObj["quantity"]?.jsonPrimitive?.content?.toDoubleOrNull() ?: 0.0
                val unit = ingredientObj["unit"]?.jsonPrimitive?.contentOrNull ?: "g"
                val required = ingredientObj["required"]?.jsonPrimitive?.contentOrNull?.toBooleanStrictOrNull() ?: true
                ProductIngredientImport(ingredient = ingredientName, quantity = quantity, unit = unit, required = required)
            }

            val recipeEntries = obj["recipe"]?.jsonArray.orEmpty().mapNotNull { ingredientElement ->
                val ingredientObj = ingredientElement.jsonObject
                val ingredientName = ingredientObj["ingredient"]?.jsonPrimitive?.contentOrNull ?: ingredientObj["name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                val quantity = ingredientObj["quantity"]?.jsonPrimitive?.content?.toDoubleOrNull() ?: 0.0
                val unit = ingredientObj["unit"]?.jsonPrimitive?.contentOrNull ?: "g"
                val required = ingredientObj["required"]?.jsonPrimitive?.contentOrNull?.toBooleanStrictOrNull() ?: true
                ProductIngredientImport(ingredient = ingredientName, quantity = quantity, unit = unit, required = required)
            }

            ProductImport(name, category, price, available, stationType, ingredientEntries, recipeEntries)
        }

        val addOns = root["addOns"]?.jsonArray.orEmpty().mapNotNull { element ->
            val obj = element.jsonObject
            val name = obj["name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
            val priceDelta = obj["priceDelta"]?.jsonPrimitive?.content?.toDoubleOrNull() ?: 0.0
            AddOnImport(name, priceDelta)
        }

        return if (categories.isNotEmpty() || products.isNotEmpty() || ingredients.isNotEmpty() || addOns.isNotEmpty()) {
            SimpleMenuData(categories, products, addOns, ingredients)
        } else {
            null
        }
    }
}
