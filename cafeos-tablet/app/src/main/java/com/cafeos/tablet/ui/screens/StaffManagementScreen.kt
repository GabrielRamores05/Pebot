package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.Attendance
import com.cafeos.tablet.data.Staff
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.components.PremiumHeader
import com.cafeos.tablet.ui.components.PremiumScreen
import com.cafeos.tablet.ui.theme.*
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

/** Web (Windows app) permission flags shown in the staff editor. */
private val WEB_PERMISSION_OPTIONS: List<Pair<String, String>> = listOf(
    "liveOrders" to "Live Orders",
    "terminal" to "New Order",
    "tables" to "Tables",
    "analytics" to "Analytics",
    "products" to "Products",
    "inventory" to "Inventory",
    "kitchen" to "Kitchen",
    "loyalty" to "Loyalty",
    "staff" to "Staff",
    "settings" to "Settings"
)

/** Maps legacy tablet route tokens to their web permission key. */
private val LEGACY_ROUTE_TO_PERMISSION: Map<String, String> = mapOf(
    "pos" to "terminal",
    "live_orders" to "liveOrders",
    "kitchen" to "kitchen",
    "analytics" to "analytics",
    "order_history" to "analytics",
    "expenses" to "inventory",
    "vouchers" to "loyalty",
    "products" to "products",
    "inventory" to "inventory",
    "tables" to "tables",
    "stock_history" to "inventory",
    "reviews" to "products",
    "loyalty" to "loyalty",
    "settings" to "settings",
    "staff" to "staff",
    "connection" to "settings"
)

private val WEB_KEYS = WEB_PERMISSION_OPTIONS.map { it.first }.toSet()

/** Reads web-JSON or legacy CSV permissions into a set of web keys. */
private fun parseStaffPermissions(raw: String?): Set<String> {
    val s = raw?.trim().orEmpty()
    if (s.isEmpty()) return emptySet()
    return if (s.startsWith("{")) {
        try {
            Json { ignoreUnknownKeys = true }.decodeFromString<Map<String, Boolean>>(s)
                .filterValues { it }.keys.toSet()
        } catch (_: Exception) {
            emptySet()
        }
    } else {
        s.split(",").map { it.trim() }.filter { it.isNotEmpty() }.mapNotNull { token ->
            LEGACY_ROUTE_TO_PERMISSION[token] ?: token.takeIf { it in WEB_KEYS }
        }.toSet()
    }
}

/** Serializes web keys to the web JSON shape: {"liveOrders":true,...}. */
private fun serializeStaffPermissions(perms: Set<String>): String = "{" +
    WEB_PERMISSION_OPTIONS.joinToString(",") { (key, _) -> "\"$key\":${if (key in perms) "true" else "false"}" } +
    "}"

private fun staffDayStart(): Long = Calendar.getInstance().apply {
    set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
}.timeInMillis

private fun staffDayEnd(): Long = staffDayStart() + 24 * 3600_000L

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StaffManagementScreen(viewModel: CafeViewModel) {
    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf("Team", "Time Clock", "Time Off", "Training", "Documents", "Reviews", "Schedule", "Payroll")

    PremiumScreen {
        PremiumHeader("Staff & HR", "Manage the team and working time")
        ScrollableTabRow(
            selectedTabIndex = selectedTab,
            edgePadding = 0.dp,
            divider = {},
            containerColor = PosCoffeeLight,
            contentColor = PosGold
        ) {
            tabs.forEachIndexed { index, title ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = { Text(title) }
                )
            }
        }
        Spacer(modifier = Modifier.height(16.dp))
        when (selectedTab) {
            0 -> StaffTeamSection(viewModel)
            1 -> TimeClockSection(viewModel)
            2 -> TimeOffSection(viewModel)
            3 -> TrainingSection(viewModel)
            4 -> DocumentsSection(viewModel)
            5 -> ReviewsSection(viewModel)
            6 -> ScheduleSection(viewModel)
            else -> PayrollSection(viewModel)
        }
    }
}

@Composable
private fun StaffTeamSection(viewModel: CafeViewModel) {
    val staff by viewModel.allStaff.collectAsState(initial = emptyList())
    var showAddDialog by remember { mutableStateOf(false) }
    var editingStaff by remember { mutableStateOf<Staff?>(null) }
    val scope = rememberCoroutineScope()

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End
        ) {
            Button(
                onClick = { editingStaff = null; showAddDialog = true },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Add Staff", fontWeight = FontWeight.SemiBold)
            }
        }
        Spacer(modifier = Modifier.height(12.dp))

        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(staff) { member ->
                StaffCard(
                    staff = member,
                    onEdit = { editingStaff = member; showAddDialog = true },
                    onDelete = { scope.launch { viewModel.deleteStaff(member) } }
                )
            }
        }
    }

    if (showAddDialog) {
        StaffFormDialog(
            staff = editingStaff,
            onDismiss = { showAddDialog = false; editingStaff = null },
            onSave = { saved ->
                scope.launch {
                    viewModel.saveStaff(saved)
                    showAddDialog = false
                    editingStaff = null
                }
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TimeClockSection(viewModel: CafeViewModel) {
    val staff by viewModel.allStaff.collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()
    val timeFormat = remember { SimpleDateFormat("hh:mm a", Locale.getDefault()) }
    val dayStart = remember { staffDayStart() }
    val dayEnd = remember { staffDayEnd() }
    var openAttendance by remember { mutableStateOf<Map<Int, Attendance>>(emptyMap()) }
    var loaded by remember { mutableStateOf(false) }

    suspend fun reload() {
        val map = mutableMapOf<Int, Attendance>()
        for (member in staff) {
            val rows = viewModel.getStaffAttendance(member.id, dayStart, dayEnd)
            rows.firstOrNull { it.clockOut == null }?.let { map[member.id] = it }
        }
        openAttendance = map
        loaded = true
    }

    LaunchedEffect(staff) { reload() }

    Column(modifier = Modifier.fillMaxSize()) {
        Text(
            text = if (loaded) "Today's clock-ins" else "Loading…",
            style = MaterialTheme.typography.labelMedium,
            color = PosMuted
        )
        Spacer(modifier = Modifier.height(8.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(staff) { member ->
                val open = openAttendance[member.id]
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = PosCoffeeLight)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(member.name, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                            if (open != null) {
                                Text(
                                    "Clocked in at ${timeFormat.format(Date(open.clockIn))}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = PosAccent,
                                    fontWeight = FontWeight.Bold
                                )
                            } else {
                                Text("Not clocked in", style = MaterialTheme.typography.bodySmall, color = PosMuted)
                            }
                        }
                        if (open == null) {
                            Button(
                                onClick = { scope.launch { viewModel.clockIn(member.id); reload() } },
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
                            ) { Text("Clock In", fontWeight = FontWeight.SemiBold) }
                        } else {
                            OutlinedButton(
                                onClick = { scope.launch { viewModel.clockOut(open.id); reload() } },
                                shape = RoundedCornerShape(10.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, PosBorder)
                            ) { Text("Clock Out", color = PosGold) }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TimeOffSection(viewModel: CafeViewModel) {
    val staff by viewModel.allStaff.collectAsState(initial = emptyList())
    val pending by viewModel.pendingLeaveRequests.collectAsState(initial = emptyList())
    val leaveTypes by viewModel.getAllLeaveTypes().collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()
    val staffName = { id: Int -> staff.firstOrNull { it.id == id }?.name ?: "Staff #$id" }
    val dateLabel = { ms: Long -> SimpleDateFormat("MMM dd, yyyy", Locale.getDefault()).format(Date(ms)) }

    var showRequestForm by remember { mutableStateOf(false) }
    var selectedStaffId by remember { mutableStateOf<Int?>(null) }
    var type by remember { mutableStateOf("ANNUAL") }
    var startText by remember { mutableStateOf("") }
    var endText by remember { mutableStateOf("") }
    var reasonText by remember { mutableStateOf("") }
    val parser = remember { SimpleDateFormat("yyyy-MM-dd", Locale.US) }

    fun parseDay(text: String): Long? = try { parser.parse(text)?.time } catch (_: Exception) { null }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("${pending.size} pending request(s)", style = MaterialTheme.typography.labelLarge, color = PosMuted)
            Button(
                onClick = { showRequestForm = true },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
            ) { Text("New Request", fontWeight = FontWeight.SemiBold) }
        }
        Spacer(modifier = Modifier.height(12.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (pending.isEmpty()) {
                item { Text("No pending leave requests", color = PosMuted, modifier = Modifier.padding(vertical = 24.dp)) }
            }
            items(pending) { request ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = PosCoffeeLight)
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(staffName(request.staffId), style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                                Text("${request.type} · ${dateLabel(request.startDate)} → ${dateLabel(request.endDate)}", style = MaterialTheme.typography.bodySmall, color = PosMuted)
                                request.reason?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = PosInkSoft) }
                            }
                            Row {
                                TextButton(onClick = { scope.launch { viewModel.approveLeaveRequest(request) } }) {
                                    Text("Approve", color = PosAccent, fontWeight = FontWeight.Bold)
                                }
                                TextButton(onClick = { scope.launch { viewModel.rejectLeaveRequest(request) } }) {
                                    Text("Reject", color = PosDanger)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showRequestForm) {
        AlertDialog(
            onDismissRequest = { showRequestForm = false },
            title = { Text("New Leave Request", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text("Staff", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        staff.forEach { s ->
                            FilterChip(
                                selected = selectedStaffId == s.id,
                                onClick = { selectedStaffId = s.id },
                                label = { Text(s.name) },
                                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PosAccentSoft, selectedLabelColor = PosAccent)
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        val options = (leaveTypes.map { it.name } + listOf("ANNUAL", "SICK", "URGENT")).distinct()
                        options.forEach { t ->
                            FilterChip(selected = type == t, onClick = { type = t }, label = { Text(t) }, colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PosAccentSoft, selectedLabelColor = PosAccent))
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(value = startText, onValueChange = { startText = it }, label = { Text("Start date (yyyy-MM-dd)") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline), singleLine = true)
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(value = endText, onValueChange = { endText = it }, label = { Text("End date (yyyy-MM-dd)") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline), singleLine = true)
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(value = reasonText, onValueChange = { reasonText = it }, label = { Text("Reason") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val sid = selectedStaffId
                        val start = parseDay(startText)
                        val end = parseDay(endText)
                        if (sid != null && start != null && end != null && end >= start) {
                            scope.launch {
                                viewModel.requestLeave(sid, type, start, end, reasonText.ifBlank { null })
                            }
                            showRequestForm = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = PosAccent),
                    shape = RoundedCornerShape(12.dp)
                ) { Text("Submit", fontWeight = FontWeight.SemiBold) }
            },
            dismissButton = {
                TextButton(onClick = { showRequestForm = false }) { Text("Cancel", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            },
            containerColor = MaterialTheme.colorScheme.surface,
            shape = RoundedCornerShape(20.dp)
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TrainingSection(viewModel: CafeViewModel) {
    val staff by viewModel.allStaff.collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()
    var selectedStaffId by remember { mutableStateOf(staff.firstOrNull()?.id) }
    var trainings by remember { mutableStateOf<List<com.cafeos.tablet.data.StaffTraining>>(emptyList()) }
    var showAdd by remember { mutableStateOf(false) }
    var programText by remember { mutableStateOf("") }

    suspend fun reload() {
        val sid = selectedStaffId
        trainings = if (sid == null) emptyList() else viewModel.getStaffTrainings(sid)
    }

    LaunchedEffect(selectedStaffId) { reload() }

    Column(modifier = Modifier.fillMaxSize()) {
        Text("Staff", style = MaterialTheme.typography.labelMedium, color = PosMuted)
        Spacer(modifier = Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            staff.forEach { s ->
                FilterChip(
                    selected = selectedStaffId == s.id,
                    onClick = { selectedStaffId = s.id },
                    label = { Text(s.name) },
                    colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PosAccentSoft, selectedLabelColor = PosAccent)
                )
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            Button(
                onClick = { programText = ""; showAdd = true },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
            ) { Text("Add Training", fontWeight = FontWeight.SemiBold) }
        }
        Spacer(modifier = Modifier.height(12.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (trainings.isEmpty()) {
                item { Text("No training records for this staff member", color = PosMuted, modifier = Modifier.padding(vertical = 20.dp)) }
            }
            items(trainings) { t ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = PosCoffeeLight)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(t.program, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                            Text(if (t.completed) "Completed" else "Enrolled", style = MaterialTheme.typography.bodySmall, color = if (t.completed) PosAccent else PosGold)
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("Completed", style = MaterialTheme.typography.labelSmall, color = PosMuted)
                            Switch(
                                checked = t.completed,
                                onCheckedChange = { checked -> scope.launch { viewModel.updateStaffTraining(t.copy(completed = checked, certifiedAt = if (checked) System.currentTimeMillis() else null)); reload() } },
                                colors = SwitchDefaults.colors(checkedThumbColor = PosAccent)
                            )
                            IconButton(onClick = { scope.launch { viewModel.deleteStaffTraining(t); reload() } }) {
                                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = PosDanger, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAdd) {
        AlertDialog(
            onDismissRequest = { showAdd = false },
            title = { Text("Add Training", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text(if (selectedStaffId != null) staff.firstOrNull { it.id == selectedStaffId }?.name ?: "" else "Select a staff member first", style = MaterialTheme.typography.bodyMedium, color = PosInkSoft)
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(value = programText, onValueChange = { programText = it }, label = { Text("Training program") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val sid = selectedStaffId
                        if (sid != null && programText.isNotBlank()) {
                            scope.launch {
                                viewModel.addStaffTraining(sid, programText.trim())
                                reload()
                            }
                            showAdd = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = PosAccent),
                    shape = RoundedCornerShape(12.dp)
                ) { Text("Save", fontWeight = FontWeight.SemiBold) }
            },
            dismissButton = { TextButton(onClick = { showAdd = false }) { Text("Cancel", color = MaterialTheme.colorScheme.onSurfaceVariant) } },
            containerColor = MaterialTheme.colorScheme.surface,
            shape = RoundedCornerShape(20.dp)
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DocumentsSection(viewModel: CafeViewModel) {
    val staff by viewModel.allStaff.collectAsState(initial = emptyList())
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var selectedStaffId by remember { mutableStateOf(staff.firstOrNull()?.id) }
    var documents by remember { mutableStateOf<List<com.cafeos.tablet.data.StaffDocument>>(emptyList()) }
    var showAdd by remember { mutableStateOf(false) }
    var titleText by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("CONTRACT") }
    var pickedPath by remember { mutableStateOf<String?>(null) }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: android.net.Uri? ->
        if (uri != null) {
            try {
                val input = context.contentResolver.openInputStream(uri)
                if (input != null) {
                    val name = "doc_${System.currentTimeMillis()}.bin"
                    val out = java.io.File(context.filesDir, name)
                    out.outputStream().use { os -> input.use { it.copyTo(os) } }
                    pickedPath = out.absolutePath
                }
            } catch (_: Exception) { pickedPath = null }
        }
    }

    suspend fun reload() {
        val sid = selectedStaffId
        documents = if (sid == null) emptyList() else viewModel.getStaffDocuments(sid)
    }

    LaunchedEffect(selectedStaffId) { reload() }

    Column(modifier = Modifier.fillMaxSize()) {
        Text("Staff", style = MaterialTheme.typography.labelMedium, color = PosMuted)
        Spacer(modifier = Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            staff.forEach { s ->
                FilterChip(
                    selected = selectedStaffId == s.id,
                    onClick = { selectedStaffId = s.id },
                    label = { Text(s.name) },
                    colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PosAccentSoft, selectedLabelColor = PosAccent)
                )
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            Button(
                onClick = { titleText = ""; type = "CONTRACT"; pickedPath = null; showAdd = true },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
            ) { Text("Add Document", fontWeight = FontWeight.SemiBold) }
        }
        Spacer(modifier = Modifier.height(12.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (documents.isEmpty()) {
                item { Text("No documents for this staff member", color = PosMuted, modifier = Modifier.padding(vertical = 20.dp)) }
            }
            items(documents) { doc ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = PosCoffeeLight)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(doc.title, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                            Text("${doc.fileType ?: "OTHER"} · ${SimpleDateFormat("MMM dd, yyyy", Locale.getDefault()).format(Date(doc.uploadedAt))}", style = MaterialTheme.typography.bodySmall, color = PosMuted)
                        }
                        IconButton(onClick = { scope.launch { viewModel.deleteStaffDocument(doc); reload() } }) {
                            Icon(Icons.Default.Delete, contentDescription = "Delete", tint = PosDanger, modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }
        }
    }

    if (showAdd) {
        AlertDialog(
            onDismissRequest = { showAdd = false },
            title = { Text("Add Document", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text(selectedStaffId?.let { id -> staff.firstOrNull { it.id == id }?.name } ?: "Select a staff member first", style = MaterialTheme.typography.bodyMedium, color = PosInkSoft)
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(value = titleText, onValueChange = { titleText = it }, label = { Text("Document name") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("CONTRACT", "NDA", "CERTIFICATION", "OTHER").forEach { t ->
                            FilterChip(selected = type == t, onClick = { type = t }, label = { Text(t) }, colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PosAccentSoft, selectedLabelColor = PosAccent))
                        }
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedButton(
                        onClick = { picker.launch("*/*") },
                        modifier = Modifier.fillMaxWidth(),
                        border = androidx.compose.foundation.BorderStroke(1.dp, PosBorder)
                    ) {
                        Text(if (pickedPath == null) "Choose file" else "File selected", color = PosGold)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val sid = selectedStaffId
                        val path = pickedPath
                        if (sid != null && titleText.isNotBlank() && path != null) {
                            scope.launch {
                                viewModel.addStaffDocument(sid, titleText.trim(), path, type)
                                reload()
                            }
                            showAdd = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = PosAccent),
                    shape = RoundedCornerShape(12.dp)
                ) { Text("Save", fontWeight = FontWeight.SemiBold) }
            },
            dismissButton = { TextButton(onClick = { showAdd = false }) { Text("Cancel", color = MaterialTheme.colorScheme.onSurfaceVariant) } },
            containerColor = MaterialTheme.colorScheme.surface,
            shape = RoundedCornerShape(20.dp)
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReviewsSection(viewModel: CafeViewModel) {
    val staff by viewModel.allStaff.collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()
    var selectedStaffId by remember { mutableStateOf(staff.firstOrNull()?.id) }
    var reviews by remember { mutableStateOf<List<com.cafeos.tablet.data.PerformanceReview>>(emptyList()) }
    var showAdd by remember { mutableStateOf(false) }
    var score by remember { mutableStateOf(5) }
    var commentsText by remember { mutableStateOf("") }

    suspend fun reload() {
        val sid = selectedStaffId
        reviews = if (sid == null) emptyList() else viewModel.getStaffReviews(sid)
    }

    LaunchedEffect(selectedStaffId) { reload() }

    Column(modifier = Modifier.fillMaxSize()) {
        Text("Staff", style = MaterialTheme.typography.labelMedium, color = PosMuted)
        Spacer(modifier = Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            staff.forEach { s ->
                FilterChip(
                    selected = selectedStaffId == s.id,
                    onClick = { selectedStaffId = s.id },
                    label = { Text(s.name) },
                    colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PosAccentSoft, selectedLabelColor = PosAccent)
                )
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            Button(
                onClick = { score = 5; commentsText = ""; showAdd = true },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
            ) { Text("New Review", fontWeight = FontWeight.SemiBold) }
        }
        Spacer(modifier = Modifier.height(12.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (reviews.isEmpty()) {
                item { Text("No performance reviews for this staff member", color = PosMuted, modifier = Modifier.padding(vertical = 20.dp)) }
            }
            items(reviews) { review ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = PosCoffeeLight)
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("★".repeat(review.score.coerceIn(1, 5)), style = MaterialTheme.typography.titleMedium, color = PosGold, fontWeight = FontWeight.Bold)
                            Text(SimpleDateFormat("MMM dd, yyyy", Locale.getDefault()).format(Date(review.date)), style = MaterialTheme.typography.bodySmall, color = PosMuted)
                        }
                        review.comments?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = PosInkSoft, modifier = Modifier.padding(top = 6.dp)) }
                    }
                }
            }
        }
    }

    if (showAdd) {
        AlertDialog(
            onDismissRequest = { showAdd = false },
            title = { Text("New Performance Review", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text(selectedStaffId?.let { id -> staff.firstOrNull { it.id == id }?.name } ?: "Select a staff member first", style = MaterialTheme.typography.bodyMedium, color = PosInkSoft)
                    Spacer(modifier = Modifier.height(10.dp))
                    Text("Rating", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        (1..5).forEach { s ->
                            FilterChip(selected = score == s, onClick = { score = s }, label = { Text("$s ★") }, colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PosAccentSoft, selectedLabelColor = PosAccent))
                        }
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(value = commentsText, onValueChange = { commentsText = it }, label = { Text("Comments") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val sid = selectedStaffId
                        if (sid != null) {
                            scope.launch {
                                viewModel.addPerformanceReview(sid, reviewerId = null, score = score, comments = commentsText.ifBlank { null })
                                reload()
                            }
                            showAdd = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = PosAccent),
                    shape = RoundedCornerShape(12.dp)
                ) { Text("Save", fontWeight = FontWeight.SemiBold) }
            },
            dismissButton = { TextButton(onClick = { showAdd = false }) { Text("Cancel", color = MaterialTheme.colorScheme.onSurfaceVariant) } },
            containerColor = MaterialTheme.colorScheme.surface,
            shape = RoundedCornerShape(20.dp)
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ScheduleSection(viewModel: CafeViewModel) {
    val staff by viewModel.allStaff.collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()
    val dayNames = listOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
    var selectedStaffId by remember { mutableStateOf(staff.firstOrNull()?.id) }
    var schedules by remember { mutableStateOf<List<com.cafeos.tablet.data.Schedule>>(emptyList()) }
    var showDialog by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<com.cafeos.tablet.data.Schedule?>(null) }
    var dayIndex by remember { mutableStateOf(0) }
    var startText by remember { mutableStateOf("09:00") }
    var endText by remember { mutableStateOf("17:00") }

    suspend fun reload() {
        val sid = selectedStaffId
        schedules = if (sid == null) emptyList() else viewModel.getStaffSchedules(sid)
    }

    LaunchedEffect(selectedStaffId) { reload() }

    Column(modifier = Modifier.fillMaxSize()) {
        Text("Staff", style = MaterialTheme.typography.labelMedium, color = PosMuted)
        Spacer(modifier = Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            staff.forEach { s ->
                FilterChip(
                    selected = selectedStaffId == s.id,
                    onClick = { selectedStaffId = s.id },
                    label = { Text(s.name) },
                    colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PosAccentSoft, selectedLabelColor = PosAccent)
                )
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            Button(
                onClick = { editing = null; dayIndex = 0; startText = "09:00"; endText = "17:00"; showDialog = true },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
            ) { Text("Add Shift", fontWeight = FontWeight.SemiBold) }
        }
        Spacer(modifier = Modifier.height(12.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            itemsIndexed(dayNames) { index, day ->
                val daySchedules = schedules.filter { it.dayOfWeek == index }
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = if (daySchedules.isEmpty()) PosCoffeeLight else PosAccentSoft.copy(alpha = 0.55f))
                ) {
                    Row(modifier = Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(day, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                            if (daySchedules.isNotEmpty()) {
                                daySchedules.forEach { s ->
                                    Text("${s.shiftStart} – ${s.shiftEnd}", style = MaterialTheme.typography.bodyMedium, color = PosAccent, fontWeight = FontWeight.Bold)
                                }
                            } else {
                                Text("Off", style = MaterialTheme.typography.bodySmall, color = PosMuted)
                            }
                        }
                        Row {
                            if (daySchedules.isNotEmpty()) {
                                IconButton(onClick = {
                                    editing = daySchedules.first()
                                    dayIndex = index
                                    startText = daySchedules.first().shiftStart
                                    endText = daySchedules.first().shiftEnd
                                    showDialog = true
                                }) { Icon(Icons.Default.Edit, contentDescription = "Edit", tint = PosGold, modifier = Modifier.size(18.dp)) }
                                IconButton(onClick = { scope.launch { daySchedules.forEach { viewModel.deleteSchedule(it) }; reload() } }) {
                                    Icon(Icons.Default.Delete, contentDescription = "Remove", tint = PosDanger, modifier = Modifier.size(18.dp))
                                }
                            } else {
                                TextButton(onClick = { editing = null; dayIndex = index; startText = "09:00"; endText = "17:00"; showDialog = true }) { Text("Add", color = PosAccent) }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showDialog) {
        AlertDialog(
            onDismissRequest = { showDialog = false },
            title = { Text(if (editing == null) "Add Shift" else "Edit Shift", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text("Day", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        dayNames.forEachIndexed { index, day ->
                            FilterChip(selected = dayIndex == index, onClick = { dayIndex = index }, label = { Text(day.take(3)) }, colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PosAccentSoft, selectedLabelColor = PosAccent))
                        }
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(value = startText, onValueChange = { if (it.length <= 5) startText = it }, label = { Text("Shift start (HH:MM)") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline), singleLine = true)
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(value = endText, onValueChange = { if (it.length <= 5) endText = it }, label = { Text("Shift end (HH:MM)") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline), singleLine = true)
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val sid = selectedStaffId
                        if (sid != null && startText.isNotBlank() && endText.isNotBlank()) {
                            scope.launch {
                                val existing = editing
                                if (existing != null) {
                                    viewModel.updateSchedule(existing.copy(dayOfWeek = dayIndex, shiftStart = startText, shiftEnd = endText))
                                } else {
                                    viewModel.addSchedule(sid, dayIndex, startText, endText)
                                }
                                reload()
                            }
                            showDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = PosAccent),
                    shape = RoundedCornerShape(12.dp)
                ) { Text("Save", fontWeight = FontWeight.SemiBold) }
            },
            dismissButton = { TextButton(onClick = { showDialog = false }) { Text("Cancel", color = MaterialTheme.colorScheme.onSurfaceVariant) } },
            containerColor = MaterialTheme.colorScheme.surface,
            shape = RoundedCornerShape(20.dp)
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PayrollSection(viewModel: CafeViewModel) {
    val staff by viewModel.allStaff.collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))
    var selectedStaffId by remember { mutableStateOf(staff.firstOrNull()?.id) }
    var payrolls by remember { mutableStateOf<List<com.cafeos.tablet.data.Payroll>>(emptyList()) }
    var showDialog by remember { mutableStateOf(false) }
    val parser = remember { SimpleDateFormat("yyyy-MM-dd", Locale.US) }
    // Dialog inputs
    var periodStartText by remember { mutableStateOf("") }
    var periodEndText by remember { mutableStateOf("") }
    var baseSalaryText by remember { mutableStateOf("0") }
    var overtimeText by remember { mutableStateOf("0") }
    var sssText by remember { mutableStateOf("0") }
    var philhealthText by remember { mutableStateOf("0") }
    var pagibigText by remember { mutableStateOf("0") }
    var taxText by remember { mutableStateOf("0") }
    var otherDeductionsText by remember { mutableStateOf("0") }

    suspend fun reload() {
        val sid = selectedStaffId
        payrolls = if (sid == null) emptyList() else viewModel.getStaffPayrolls(sid)
    }

    LaunchedEffect(selectedStaffId) { reload() }

    Column(modifier = Modifier.fillMaxSize()) {
        Text("Staff", style = MaterialTheme.typography.labelMedium, color = PosMuted)
        Spacer(modifier = Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            staff.forEach { s ->
                FilterChip(
                    selected = selectedStaffId == s.id,
                    onClick = { selectedStaffId = s.id },
                    label = { Text(s.name) },
                    colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PosAccentSoft, selectedLabelColor = PosAccent)
                )
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            Button(
                onClick = {
                    val member = staff.firstOrNull { it.id == selectedStaffId }
                    periodStartText = ""
                    periodEndText = ""
                    baseSalaryText = (member?.monthlySalary ?: member?.hourlyRate?.times(160.0) ?: 0.0).toString()
                    overtimeText = "0"; sssText = "0"; philhealthText = "0"; pagibigText = "0"; taxText = "0"; otherDeductionsText = "0"
                    showDialog = true
                },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
            ) { Text("Generate Payroll", fontWeight = FontWeight.SemiBold) }
        }
        Spacer(modifier = Modifier.height(12.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (payrolls.isEmpty()) {
                item { Text("No payroll records for this staff member", color = PosMuted, modifier = Modifier.padding(vertical = 20.dp)) }
            }
            items(payrolls) { payroll ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = PosCoffeeLight)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("${SimpleDateFormat("MMM d", Locale.getDefault()).format(Date(payroll.periodStart))} – ${SimpleDateFormat("MMM d, yyyy", Locale.getDefault()).format(Date(payroll.periodEnd))}", style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                            Text(
                                "Gross ${currencyFormatter.format(payroll.baseSalary + payroll.overtimePay)} · Deductions ${currencyFormatter.format(payroll.sss + payroll.philhealth + payroll.pagibig + payroll.tax + payroll.deductions)}",
                                style = MaterialTheme.typography.bodySmall,
                                color = PosMuted
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(currencyFormatter.format(payroll.netPay), style = MaterialTheme.typography.titleLarge, color = PosGold, fontWeight = FontWeight.Bold)
                            if (payroll.status == "PENDING") {
                                TextButton(onClick = { scope.launch { viewModel.updatePayroll(payroll.copy(status = "PAID")); reload() } }) {
                                    Text("Mark Paid", color = PosAccent, fontWeight = FontWeight.Bold)
                                }
                            } else {
                                Text("Paid", style = MaterialTheme.typography.labelMedium, color = PosAccent, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }

    if (showDialog) {
        AlertDialog(
            onDismissRequest = { showDialog = false },
            title = { Text("Generate Payroll", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
            text = {
                Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                    fun dbl(v: String) = v.toDoubleOrNull() ?: 0.0
                    OutlinedTextField(value = periodStartText, onValueChange = { periodStartText = it }, label = { Text("Period start (yyyy-MM-dd)") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline), singleLine = true)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(value = periodEndText, onValueChange = { periodEndText = it }, label = { Text("Period end (yyyy-MM-dd)") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline), singleLine = true)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(value = baseSalaryText, onValueChange = { baseSalaryText = it.filter { c -> c.isDigit() || c == '.' } }, label = { Text("Base salary (₱)") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline), singleLine = true)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(value = overtimeText, onValueChange = { overtimeText = it.filter { c -> c.isDigit() || c == '.' } }, label = { Text("Overtime pay (₱)") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline), singleLine = true)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(value = sssText, onValueChange = { sssText = it.filter { c -> c.isDigit() || c == '.' } }, label = { Text("SSS (₱)") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline), singleLine = true)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(value = philhealthText, onValueChange = { philhealthText = it.filter { c -> c.isDigit() || c == '.' } }, label = { Text("PhilHealth (₱)") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline), singleLine = true)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(value = pagibigText, onValueChange = { pagibigText = it.filter { c -> c.isDigit() || c == '.' } }, label = { Text("Pag-IBIG (₱)") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline), singleLine = true)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(value = taxText, onValueChange = { taxText = it.filter { c -> c.isDigit() || c == '.' } }, label = { Text("Withholding tax (₱)") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline), singleLine = true)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(value = otherDeductionsText, onValueChange = { otherDeductionsText = it.filter { c -> c.isDigit() || c == '.' } }, label = { Text("Other deductions (₱)") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline), singleLine = true)
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val sid = selectedStaffId
                        val member = staff.firstOrNull { it.id == sid }
                        val start = try { parser.parse(periodStartText)?.time } catch (_: Exception) { null }
                        val end = try { parser.parse(periodEndText)?.time } catch (_: Exception) { null }
                        if (sid != null && start != null && end != null && end >= start) {
                            scope.launch {
                                viewModel.generatePayroll(
                                    staffId = sid,
                                    periodStart = start,
                                    periodEnd = end,
                                    baseSalary = baseSalaryText.toDoubleOrNull() ?: 0.0,
                                    overtimePay = overtimeText.toDoubleOrNull() ?: 0.0,
                                    sss = sssText.toDoubleOrNull() ?: 0.0,
                                    philhealth = philhealthText.toDoubleOrNull() ?: 0.0,
                                    pagibig = pagibigText.toDoubleOrNull() ?: 0.0,
                                    tax = taxText.toDoubleOrNull() ?: 0.0,
                                    deductions = otherDeductionsText.toDoubleOrNull() ?: 0.0,
                                    profitShareRate = member?.profitShareRate ?: 0.0
                                )
                                reload()
                            }
                            showDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = PosAccent),
                    shape = RoundedCornerShape(12.dp)
                ) { Text("Generate", fontWeight = FontWeight.SemiBold) }
            },
            dismissButton = { TextButton(onClick = { showDialog = false }) { Text("Cancel", color = MaterialTheme.colorScheme.onSurfaceVariant) } },
            containerColor = MaterialTheme.colorScheme.surface,
            shape = RoundedCornerShape(20.dp)
        )
    }
}

@Composable
fun StaffCard(staff: Staff, onEdit: () -> Unit, onDelete: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = PosCoffeeLight),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(staff.name, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                Text(staff.role, style = MaterialTheme.typography.bodySmall, color = PosMuted)
                staff.email?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = PosInkSoft) }
            }
            Row {
                IconButton(onClick = onEdit) {
                    Icon(Icons.Default.Edit, contentDescription = "Edit", tint = PosGold, modifier = Modifier.size(18.dp))
                }
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = PosDanger, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StaffFormDialog(staff: Staff?, onDismiss: () -> Unit, onSave: (Staff) -> Unit) {
    var name by remember { mutableStateOf(staff?.name ?: "") }
    var role by remember { mutableStateOf(staff?.role ?: "STAFF") }
    var email by remember { mutableStateOf(staff?.email ?: "") }
    var phone by remember { mutableStateOf(staff?.phone ?: "") }
    // Never show a stored (hashed) PIN back in the editor; a blank PIN on edit
    // means "keep the current one" so saving never silently blanks a login.
    var pin by remember { mutableStateOf("") }
    var profitShareRate by remember { mutableStateOf(staff?.profitShareRate?.toString() ?: "0") }
    val permissionOptions = WEB_PERMISSION_OPTIONS
    // Web permission flags. Legacy blank permissions meant "full access" — keep
    // that meaning by seeding all keys; new staff default to web's liveOrders-only.
    var permissions by remember {
        mutableStateOf(
            if (staff != null && staff.permissions.isNullOrBlank()) WEB_KEYS
            else parseStaffPermissions(staff?.permissions).ifEmpty { if (staff == null) setOf("liveOrders") else emptySet() }
        )
    }

    // Windows role vocabulary (ADMIN/STAFF/KITCHEN). Legacy MANAGER/BARISTA rows
    // stay editable but are no longer offered for new staff.
    val webRoles = listOf("ADMIN", "STAFF", "KITCHEN")
    val roles = (webRoles + listOf(staff?.role).filterNotNull().filter { it !in webRoles && it in listOf("MANAGER", "BARISTA") }).distinct()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (staff == null) "New Staff" else "Edit Staff", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Name") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Email") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Phone") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = pin,
                    onValueChange = { pin = it.filter { c -> c.isDigit() }.take(6) },
                    label = { Text(if (staff == null) "PIN (6 digits)" else "New PIN — leave blank to keep") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline),
                    singleLine = true
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = profitShareRate, onValueChange = { profitShareRate = it.filter { c -> c.isDigit() || c == '.' } }, label = { Text("Profit share (%)") }, modifier = Modifier.fillMaxWidth(), singleLine = true, colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline), supportingText = { Text("Applied to positive net profit during payroll") })
                Spacer(modifier = Modifier.height(12.dp))
                Text("Role", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    roles.forEach { r ->
                        FilterChip(
                            selected = role == r,
                            onClick = { role = r },
                            label = { Text(r) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = PosAccentSoft,
                                selectedLabelColor = PosAccent
                            )
                        )
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
                Text("Page access", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                permissionOptions.chunked(2).forEach { row ->
                    Row(modifier = Modifier.fillMaxWidth()) {
                        row.forEach { (key, label) ->
                            Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(checked = key in permissions, onCheckedChange = { checked -> permissions = if (checked) permissions + key else permissions - key })
                                Text(label, style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isNotBlank()) {
                        val saved = if (staff == null) {
                            Staff(name = name, role = role, email = email.ifBlank { null }, phone = phone.ifBlank { null }, pin = pin.ifBlank { null }, permissions = serializeStaffPermissions(permissions), profitShareRate = profitShareRate.toDoubleOrNull()?.coerceIn(0.0, 100.0) ?: 0.0)
                        } else {
                            staff.copy(name = name, role = role, email = email.ifBlank { null }, phone = phone.ifBlank { null }, pin = if (pin.isBlank()) staff.pin else pin, permissions = serializeStaffPermissions(permissions), profitShareRate = profitShareRate.toDoubleOrNull()?.coerceIn(0.0, 100.0) ?: 0.0)
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
