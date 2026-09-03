package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.*
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.components.PremiumScreen
import com.cafeos.tablet.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OptionGroupScreen(viewModel: CafeViewModel) {
    val optionGroups by viewModel.allOptionGroups.collectAsState(initial = emptyList())
    val ingredients by viewModel.ingredients.collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()
    var showCreateDialog by remember { mutableStateOf(false) }
    var editingGroup by remember { mutableStateOf<OptionGroup?>(null) }
    var refreshTick by remember { mutableStateOf(0) }
    val optionMap = remember(optionGroups) { mutableStateMapOf<Int, List<Option>>() }

    LaunchedEffect(optionGroups, refreshTick) {
        optionGroups.forEach { group ->
            optionMap[group.id] = viewModel.getOptionsForGroup(group.id)
        }
        optionMap.keys.filterNot { groupId -> optionGroups.any { it.id == groupId } }.forEach(optionMap::remove)
    }

    PremiumScreen {
        Row(horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Option Groups", style = MaterialTheme.typography.headlineMedium, color = PosInk)
            Button(
                onClick = { editingGroup = null; showCreateDialog = true },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Add Group")
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(optionGroups) { group ->
                OptionGroupCard(
                    viewModel = viewModel,
                    group = group,
                    options = optionMap[group.id].orEmpty(),
                    ingredients = ingredients,
                    onEdit = { editingGroup = group; showCreateDialog = true },
                    onDelete = {
                        scope.launch { viewModel.deleteOptionGroup(group) }
                        refreshTick++
                    },
                    onDeleteOption = { option ->
                        scope.launch { viewModel.deleteOption(option) }
                        refreshTick++
                    },
                    onChanged = { refreshTick++ }
                )
            }
        }
    }

    if (showCreateDialog) {
        OptionGroupFormDialog(
            group = editingGroup,
            onDismiss = { showCreateDialog = false; editingGroup = null },
            onSave = { saved ->
                viewModel.saveOptionGroup(saved)
                showCreateDialog = false
                editingGroup = null
            }
        )
    }
}

@Composable
fun OptionGroupCard(
    viewModel: CafeViewModel,
    group: OptionGroup,
    options: List<Option>,
    ingredients: List<Ingredient>,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onDeleteOption: (Option) -> Unit,
    onChanged: () -> Unit
) {
    var editingOption by remember { mutableStateOf<Option?>(null) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = PosCoffeeLight),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(group.name, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                    Text(group.selectionType.replaceFirstChar { it.uppercase() }, style = MaterialTheme.typography.bodySmall, color = PosMuted)
                }
                Row {
                    IconButton(onClick = onEdit) {
                        Icon(Icons.Default.Edit, contentDescription = "Edit", tint = PosGold)
                    }
                    IconButton(onClick = onDelete) {
                        Icon(Icons.Default.Delete, contentDescription = "Delete", tint = PosDanger)
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (options.isNotEmpty()) {
                options.forEach { option ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 6.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(option.name, color = PosPaper, fontWeight = FontWeight.Medium)
                            if (option.priceDelta != 0.0) {
                                Text("+₱${option.priceDelta}", color = PosGold, style = MaterialTheme.typography.bodySmall)
                            }
                            option.ingredientId?.let { ingredientId ->
                                ingredients.find { it.id == ingredientId }?.let { ingredient ->
                                    Text(
                                        "Uses ${trimAmount(option.ingredientQuantity)} ${ingredient.baseUnit} of ${ingredient.name}",
                                        color = PosInfo,
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }
                            }
                        }
                        Row {
                            IconButton(onClick = { editingOption = option }, modifier = Modifier.size(30.dp)) {
                                Icon(Icons.Default.Edit, contentDescription = "Edit option", tint = PosGold, modifier = Modifier.size(18.dp))
                            }
                            IconButton(onClick = { onDeleteOption(option) }, modifier = Modifier.size(30.dp)) {
                                Icon(Icons.Default.Delete, contentDescription = "Delete option", tint = PosDanger, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            } else {
                Text("No options yet", color = PosMuted, style = MaterialTheme.typography.bodySmall)
            }

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = { editingOption = Option(groupId = group.id, name = "", priceDelta = 0.0) },
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PosAccentSoft),
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Add, contentDescription = null, tint = PosAccent)
                Spacer(modifier = Modifier.width(6.dp))
                Text("Add Option", color = PosAccent)
            }
        }
    }

    if (editingOption != null) {
        OptionFormDialog(
            group = group,
            option = editingOption,
            ingredients = ingredients,
            onDismiss = { editingOption = null },
            onSave = { name, priceDelta, ingredientId, ingredientQuantity ->
                val target = editingOption ?: Option(groupId = group.id, name = name, priceDelta = priceDelta)
                val updated = target.copy(
                    name = name,
                    priceDelta = priceDelta,
                    ingredientId = ingredientId,
                    ingredientQuantity = ingredientQuantity
                )
                viewModel.saveOption(updated)
                editingOption = null
                onChanged()
            }
        )
    }
}

private fun trimAmount(value: Double): String =
    if (value == value.toLong().toDouble()) value.toLong().toString() else value.toString()

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OptionGroupFormDialog(group: OptionGroup?, onDismiss: () -> Unit, onSave: (OptionGroup) -> Unit) {
    var name by remember { mutableStateOf(group?.name ?: "") }
    var selectionType by remember { mutableStateOf(group?.selectionType ?: "single") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (group == null) "New Option Group" else "Edit Option Group", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text("Selection Type", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("single", "multi").forEach { type ->
                        FilterChip(
                            selected = selectionType == type,
                            onClick = { selectionType = type },
                            label = { Text(type.replaceFirstChar { it.uppercase() }) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = PosAccentSoft,
                                selectedLabelColor = PosAccent
                            )
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isNotBlank()) {
                        val saved = if (group == null) {
                            OptionGroup(name = name, selectionType = selectionType)
                        } else {
                            group.copy(name = name, selectionType = selectionType)
                        }
                        onSave(saved)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Save", fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        containerColor = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp)
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OptionFormDialog(
    group: OptionGroup,
    option: Option?,
    ingredients: List<Ingredient>,
    onDismiss: () -> Unit,
    onSave: (String, Double, Int?, Double) -> Unit
) {
    var name by remember { mutableStateOf(option?.name ?: "") }
    var priceDelta by remember { mutableStateOf((option?.priceDelta ?: 0.0).toString()) }
    var selectedIngredientId by remember { mutableStateOf(option?.ingredientId) }
    var quantityText by remember {
        mutableStateOf(
            option?.ingredientId?.let { trimAmount(option.ingredientQuantity) } ?: ""
        )
    }
    var ingredientExpanded by remember { mutableStateOf(false) }
    var validationError by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (option == null || option.id == 0) "New Option" else "Edit Option", fontWeight = FontWeight.Bold) },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Option name") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = priceDelta,
                    onValueChange = { priceDelta = it },
                    label = { Text("Price delta") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    "Extra ingredient this option consumes",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    "Example: Medium adds 25 g of Coffee Beans, Large adds 50 g.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(8.dp))
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { ingredientExpanded = !ingredientExpanded },
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.surface,
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            ingredients.find { it.id == selectedIngredientId }?.name ?: "No extra ingredient",
                            color = if (selectedIngredientId != null) MaterialTheme.colorScheme.onSurface else PosMuted,
                            fontWeight = if (selectedIngredientId != null) FontWeight.SemiBold else FontWeight.Normal
                        )
                        Icon(
                            if (ingredientExpanded) Icons.Default.ArrowDropUp else Icons.Default.ArrowDropDown,
                            contentDescription = null,
                            tint = PosAccent
                        )
                    }
                }
                if (ingredientExpanded) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                    ) {
                        Column(modifier = Modifier.padding(vertical = 4.dp)) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { selectedIngredientId = null; quantityText = ""; ingredientExpanded = false }
                                    .padding(horizontal = 14.dp, vertical = 10.dp)
                            ) {
                                Text("No extra ingredient", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Medium)
                            }
                            ingredients.forEach { ingredient ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            selectedIngredientId = ingredient.id
                                            ingredientExpanded = false
                                            if (quantityText.isBlank()) quantityText = "1"
                                        }
                                        .padding(horizontal = 14.dp, vertical = 10.dp)
                                ) {
                                    Text("${ingredient.name} (${ingredient.baseUnit})", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Medium)
                                }
                            }
                        }
                    }
                }
                if (selectedIngredientId != null) {
                    Spacer(modifier = Modifier.height(12.dp))
                    val unit = ingredients.find { it.id == selectedIngredientId }?.baseUnit ?: "unit"
                    OutlinedTextField(
                        value = quantityText,
                        onValueChange = { quantityText = it.filter { c -> c.isDigit() || c == '.' } },
                        label = { Text("Amount per option ($unit)") },
                        supportingText = { Text("This much is deducted from stock with every option chosen") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                    )
                }
                validationError?.let {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(it, color = PosDanger, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val parsed = priceDelta.toDoubleOrNull() ?: 0.0
                    val ingredientId = selectedIngredientId
                    val qty = if (ingredientId != null) quantityText.toDoubleOrNull() else null
                    validationError = when {
                        name.isBlank() -> "Enter an option name."
                        ingredientId != null && (qty == null || qty <= 0.0) ->
                            "Enter how much of the ingredient this option uses."
                        else -> null
                    }
                    if (validationError == null && name.isNotBlank()) {
                        onSave(name, parsed, ingredientId, qty ?: 0.0)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
        containerColor = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp)
    )
}
