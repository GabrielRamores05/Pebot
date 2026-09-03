package com.cafeos.tablet.data

import android.content.Context
import android.print.PrintAttributes
import android.print.PrintManager
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import android.os.Build
import android.util.Log
import androidx.annotation.RequiresApi
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Renders a BIR-style sales invoice / official receipt as a clean A4 PDF and
 * hands it to the Android print service. Layout mirrors a standard Filipino
 * café receipt: business header with TIN, sequential receipt number, date,
 * itemized table, VAT breakdown, payment detail, amount in words and footer.
 */
class ReceiptPrinter(private val context: Context) {

    companion object {
        private const val TAG = "ReceiptPrinter"
        private const val PAGE_W = 595   // A4 portrait, points
        private const val PAGE_H = 842
        private const val MARGIN = 48f
        private const val CONTENT_W = PAGE_W - MARGIN * 2
        private val CURRENCY = NumberFormat.getCurrencyInstance(Locale("en", "PH"))
        private val DATE_FMT = SimpleDateFormat("MMM dd, yyyy  hh:mm a", Locale.getDefault())
    }

    @RequiresApi(Build.VERSION_CODES.LOLLIPOP)
    fun printReceipt(
        order: Order,
        orderItems: List<OrderItem>,
        products: List<Product>,
        businessSettings: BusinessSettings?,
        orderOptionsByItem: Map<Int, List<OrderOption>> = emptyMap(),
        payment: Payment? = null
    ) {
        try {
            val pdfFile = generateReceiptPdf(order, orderItems, products, businessSettings, orderOptionsByItem, payment)
            val printManager = context.getSystemService(Context.PRINT_SERVICE) as PrintManager
            val printAttributes = PrintAttributes.Builder()
                .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                .setResolution(PrintAttributes.Resolution("id", context.packageName, 300, 300))
                .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                .build()

            printManager.print(
                "OfficialReceipt_${order.orderNumber}",
                PdfDocumentAdapter(pdfFile),
                printAttributes
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to print receipt", e)
        }
    }

    @RequiresApi(Build.VERSION_CODES.LOLLIPOP)
    private fun generateReceiptPdf(
        order: Order,
        orderItems: List<OrderItem>,
        products: List<Product>,
        settings: BusinessSettings?,
        orderOptionsByItem: Map<Int, List<OrderOption>> = emptyMap(),
        payment: Payment? = null
    ): File {
        val doc = PdfDocument()
        val title = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK; textSize = 20f; textAlign = Paint.Align.CENTER; typeface = android.graphics.Typeface.DEFAULT_BOLD }
        val small = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.DKGRAY; textSize = 9f; textAlign = Paint.Align.CENTER }
        val label = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK; textSize = 9.5f }
        val value = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK; textSize = 9.5f; textAlign = Paint.Align.RIGHT }
        val body = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK; textSize = 10f }
        val bodyBold = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK; textSize = 10f; typeface = android.graphics.Typeface.DEFAULT_BOLD }
        val total = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK; textSize = 15f; typeface = android.graphics.Typeface.DEFAULT_BOLD }
        val ruler = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#444444"); strokeWidth = 1.4f }
        val thin = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#999999"); strokeWidth = 0.7f }

        val productMap = products.associateBy { it.id }
        val itemRows = orderItems.flatMap { item ->
            val name = productMap[item.productId]?.name ?: "Item ${item.productId}"
            val detail = "${item.quantity} x ${CURRENCY.format(item.unitPrice)}"
            val amount = CURRENCY.format(item.subtotal)
            val opts = orderOptionsByItem[item.id].orEmpty()
            val optRows = opts.map { o ->
                val delta = if (o.priceDelta > 0) " (${CURRENCY.format(o.priceDelta)})" else ""
                Triple("      + ${o.name}: ${o.value}$delta", "", "")
            }
            listOf(Triple(name, detail, amount)) + optRows
        }

        var page = doc.startPage(android.graphics.pdf.PdfDocument.PageInfo.Builder(PAGE_W, PAGE_H, 1).create())
        var y = MARGIN
        var pageIndex = 1
        var firstPage = true

        fun newPageIfNeeded(needed: Float): Boolean {
            if (y + needed <= PAGE_H - MARGIN) return false
            doc.finishPage(page)
            pageIndex++
            page = doc.startPage(android.graphics.pdf.PdfDocument.PageInfo.Builder(PAGE_W, PAGE_H, pageIndex).create())
            y = MARGIN
            firstPage = true
            return true
        }

        // ── Header (repeated on every page so continuation pages stay official) ──
        fun drawHeader() {
            val shopName = settings?.shopName?.takeIf { it.isNotBlank() } ?: "Pebot"
            canvasOf(page).drawText(shopName, PAGE_W / 2f, y, title)
            y += 16f
            canvasOf(page).drawText(
                settings?.address ?: "CaféOS – this café's local point of sale",
                PAGE_W / 2f, y, small
            )
            y += 12f
            if (settings?.tin?.isNotBlank() == true) {
                canvasOf(page).drawText("VAT Reg. TIN: ${settings.tin}", PAGE_W / 2f, y, small)
                y += 12f
            }
            y += 4f
            canvasOf(page).drawLine(MARGIN, y, PAGE_W - MARGIN, y, ruler)
            y += 20f
            canvasOf(page).drawText("OFFICIAL RECEIPT", PAGE_W / 2f, y, Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.BLACK; textSize = 15f; textAlign = Paint.Align.CENTER; typeface = android.graphics.Typeface.DEFAULT_BOLD
            })
            y += 13f
            canvasOf(page).drawText("This document serves as the official receipt for this transaction", PAGE_W / 2f, y, small)
            y += 14f
            canvasOf(page).drawLine(MARGIN, y, PAGE_W - MARGIN, y, ruler)
            y += 16f
            firstPage = false
        }

        drawHeader()

        // ── Reference block ──
        fun drawMeta(leftText: String, rightText: String) {
            newPageIfNeeded(14f)
            if (firstPage) drawHeader()
            canvasOf(page).drawText(leftText, MARGIN, y, label)
            canvasOf(page).drawText(rightText, PAGE_W - MARGIN, y, value)
            y += 14f
        }

        drawMeta("Official Receipt No.", order.orderNumber)
        drawMeta("Date & Time", DATE_FMT.format(Date(order.createdAt)))
        drawMeta("Order Type", when (order.orderType) {
            "DELIVERY" -> "Delivery"
            "TAKEOUT" -> "Takeout"
            else -> "Dine-in"
        })
        if (order.orderType == "DELIVERY" && !order.deliveryAddress.isNullOrBlank()) {
            drawMeta("Deliver to", order.deliveryAddress)
        } else {
            drawMeta("Table / Location", order.tableLocation ?: order.tableId?.let { "Table $it" } ?: "Takeaway")
        }
        drawMeta("Customer", order.customerName.ifBlank { "Walk-in Customer" })
        y += 6f

        // ── Items table ──
        newPageIfNeeded(18f)
        if (firstPage) drawHeader()
        canvasOf(page).drawLine(MARGIN, y - 3f, PAGE_W - MARGIN, y - 3f, thin)
        canvasOf(page).drawText("ITEM", MARGIN, y, bodyBold)
        canvasOf(page).drawText("AMOUNT", PAGE_W - MARGIN, y, value)
        y += 6f
        canvasOf(page).drawLine(MARGIN, y, PAGE_W - MARGIN, y, thin)
        y += 13f

        for (row in itemRows) {
            val (desc, detail, amount) = row
            val lines = wrapText(desc, CONTENT_W - 150f, body)
            for ((i, line) in lines.withIndex()) {
                newPageIfNeeded(15f)
                if (firstPage) drawHeader()
                canvasOf(page).drawText(line, MARGIN, y, if (i == 0) bodyBold else body)
                if (i == 0 && detail.isNotEmpty()) {
                    canvasOf(page).drawText(detail, MARGIN + 130f, y, body)
                }
                if (i == 0 && amount.isNotEmpty()) {
                    canvasOf(page).drawText(amount, PAGE_W - MARGIN, y, value)
                }
                y += 14f
            }
        }

        y += 4f
        canvasOf(page).drawLine(MARGIN, y, PAGE_W - MARGIN, y, ruler)
        y += 16f

        // ── Totals / VAT ──
        val subtotal = orderItems.sumOf { it.subtotal }
        val discount = order.discountAmount.coerceAtLeast(0.0)
        val totalDue = order.totalAmount.coerceAtLeast(0.0)
        val rate = (settings?.vatRate ?: 0.0).coerceIn(0.0, 100.0)

        fun drawTotalRow(leftText: String, amountText: String, bold: Boolean = false) {
            newPageIfNeeded(18f)
            if (firstPage) drawHeader()
            // Fresh paint copies every row so alignment/size mutations never leak.
            val leftP = Paint(if (bold) total else bodyBold)
            val rightP = Paint(leftP)
            rightP.textAlign = Paint.Align.RIGHT
            canvasOf(page).drawText(leftText, MARGIN, y, leftP)
            canvasOf(page).drawText(amountText, PAGE_W - MARGIN, y, rightP)
            y += 16f
        }

        drawTotalRow("Subtotal", CURRENCY.format(subtotal))
        if (discount > 0.0) {
            drawTotalRow("Less: Discount (${order.discountReason ?: "promo"})", "-${CURRENCY.format(discount)}")
        }
        if (rate > 0.0) {
            val vat = totalDue * rate / (100.0 + rate)
            drawTotalRow("VATable Sales", CURRENCY.format(totalDue - vat))
            drawTotalRow("VAT ($rate%)", CURRENCY.format(vat))
        }
        drawTotalRow("TOTAL DUE", CURRENCY.format(totalDue), bold = true)

        // ── Amount in words ──
        newPageIfNeeded(26f)
        if (firstPage) drawHeader()
        val words = moneyInWords(totalDue)
        val wordLines = wrapText("Amount in words: $words", CONTENT_W - 20f, body)
        wordLines.forEach { line ->
            newPageIfNeeded(13f)
            if (firstPage) drawHeader()
            canvasOf(page).drawText(line, MARGIN, y, body)
            y += 13f
        }
        y += 6f

        // ── Payment ──
        payment?.let { pay ->
            drawTotalRow("Payment method", pay.method)
            if (pay.change > 0.01) {
                drawTotalRow("Tendered", CURRENCY.format(pay.amountTendered))
                drawTotalRow("Change", CURRENCY.format(pay.change))
            }
        } ?: run {
            drawTotalRow("Payment method", order.paymentMethod)
        }

        // ── Footer ──
        newPageIfNeeded(46f)
        if (firstPage) drawHeader()
        y += 10f
        canvasOf(page).drawLine(MARGIN, y, PAGE_W - MARGIN, y, ruler)
        y += 14f
        val footer = settings?.footerMessage?.takeIf { it.isNotBlank() } ?: "Thank you for your visit!"
        canvasOf(page).drawText(footer, PAGE_W / 2f, y, small.apply { textSize = 10f })
        y += 14f
        canvasOf(page).drawText("System-generated receipt · CaféOS POS", PAGE_W / 2f, y, small)
        doc.finishPage(page)

        val file = File(context.filesDir, "official_receipt_${order.orderNumber}.pdf")
        FileOutputStream(file).use { doc.writeTo(it) }
        doc.close()
        return file
    }

    private fun canvasOf(page: PdfDocument.Page) = page.canvas

    /** Wraps text to [maxWidth] measured in the given paint, preserving words. */
    private fun wrapText(text: String, maxWidth: Float, paint: Paint): List<String> {
        if (text.isEmpty()) return listOf("")
        val words = text.split(" ")
        val lines = mutableListOf<String>()
        var current = ""
        for (word in words) {
            val candidate = if (current.isEmpty()) word else "$current $word"
            if (paint.measureText(candidate) <= maxWidth || current.isEmpty()) {
                current = candidate
            } else {
                lines.add(current)
                current = word
            }
        }
        lines.add(current)
        return lines
    }

    /** Philippine pesos amount in words, e.g. "One Hundred Twenty-Five Pesos and 50/100 Only". */
    private fun moneyInWords(amount: Double): String {
        val whole = amount.toLong()
        val cents = ((amount - whole) * 100).toLong().coerceAtLeast(0)
        val wholeWords = if (whole == 0L) "Zero" else numberWords(whole)
        val base = "$wholeWords Pesos"
        val centsPart = if (cents > 0) " and ${cents.toString().padStart(2, '0')}/100" else ""
        return "$base$centsPart Only"
    }

    private fun numberWords(n: Long): String {
        if (n == 0L) return ""
        val ones = arrayOf("", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
            "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen")
        val tens = arrayOf("", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety")
        fun under100(v: Long): String {
            return when {
                v < 20 -> ones[v.toInt()]
                else -> {
                    val t = tens[(v / 10).toInt()]
                    val o = ones[(v % 10).toInt()]
                    if (o.isEmpty()) t else "$t-$o"
                }
            }
        }
        fun block(v: Long): String {
            val h = v / 100
            val rest = v % 100
            val head = if (h > 0) "${ones[h.toInt()]} Hundred" else ""
            val tail = under100(rest)
            return listOf(head, tail).filter { it.isNotBlank() }.joinToString(" ")
        }
        val parts = mutableListOf<String>()
        var v = n
        val units = listOf("", "Thousand", "Million", "Billion")
        var unitIndex = 0
        while (v > 0) {
            val chunk = v % 1000
            if (chunk > 0) {
                val chunkWords = block(chunk)
                val suffix = units[unitIndex]
                parts.add(0, if (suffix.isEmpty()) chunkWords else "$chunkWords $suffix")
            }
            v /= 1000
            unitIndex++
        }
        return parts.joinToString(" ")
    }

    @RequiresApi(Build.VERSION_CODES.LOLLIPOP)
    private class PdfDocumentAdapter(private val pdfFile: File) : android.print.PrintDocumentAdapter() {
        override fun onLayout(
            oldAttributes: PrintAttributes?,
            newAttributes: PrintAttributes?,
            cancellationSignal: android.os.CancellationSignal?,
            layoutResultCallback: android.print.PrintDocumentAdapter.LayoutResultCallback?,
            extras: android.os.Bundle?
        ) {
            layoutResultCallback?.onLayoutFinished(
                android.print.PrintDocumentInfo.Builder("official_receipt.pdf")
                    .setContentType(android.print.PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                    .setPageCount(android.print.PrintDocumentInfo.PAGE_COUNT_UNKNOWN)
                    .build(),
                !(cancellationSignal?.isCanceled ?: false)
            )
        }

        @RequiresApi(Build.VERSION_CODES.LOLLIPOP)
        override fun onWrite(
            pages: Array<android.print.PageRange>?,
            destination: android.os.ParcelFileDescriptor?,
            cancellationSignal: android.os.CancellationSignal?,
            writeResultCallback: android.print.PrintDocumentAdapter.WriteResultCallback?
        ) {
            try {
                destination?.let { fd ->
                    val fos = FileOutputStream(fd.fileDescriptor)
                    pdfFile.inputStream().use { input -> input.copyTo(fos) }
                    fos.fd.sync()
                    fos.close()
                    writeResultCallback?.onWriteFinished(arrayOf(android.print.PageRange.ALL_PAGES))
                }
            } catch (e: IOException) {
                Log.e(TAG, "Failed writing receipt PDF", e)
                writeResultCallback?.onWriteFailed(null)
            }
        }
    }

    fun printKitchenOrder(order: Order, items: List<OrderItem>, products: List<Product>) {
        Log.d(TAG, "Printing kitchen order for ${order.orderNumber}")
    }
}
