package com.cafeos.tablet.data

import android.content.Context
import android.print.PrintAttributes
import android.print.PrintManager
import android.graphics.pdf.PdfDocument
import android.graphics.Paint
import android.graphics.pdf.PdfRenderer
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.annotation.RequiresApi
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

class ReceiptPrinter(private val context: Context) {

    companion object {
        private const val TAG = "ReceiptPrinter"
        private const val RECEIPT_WIDTH = 216
        private const val RECEIPT_HEIGHT = 300
        private const val LINE_HEIGHT = 20
        private const val MARGIN = 15
    }

    @RequiresApi(Build.VERSION_CODES.LOLLIPOP)
    fun printReceipt(order: Order, orderItems: List<OrderItem>, products: List<Product>, businessSettings: BusinessSettings?) {
        try {
            val pdfFile = generateReceiptPdf(order, orderItems, products, businessSettings)
            val printManager = context.getSystemService(Context.PRINT_SERVICE) as PrintManager
            val printAttributes = PrintAttributes.Builder()
                .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                .setResolution(PrintAttributes.Resolution("id", context.packageName, 203, 203))
                .setColorMode(PrintAttributes.COLOR_MODE_MONOCHROME)
                .build()

            printManager.print(
                "Receipt_${order.orderNumber}",
                PdfDocumentAdapter(pdfFile),
                printAttributes
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to print receipt", e)
        }
    }

        @RequiresApi(Build.VERSION_CODES.LOLLIPOP)
        private fun generateReceiptPdf(order: Order, orderItems: List<OrderItem>, products: List<Product>, settings: BusinessSettings?): File {
        val pdfDocument = PdfDocument()
        val pageInfo = PdfDocument.PageInfo.Builder(RECEIPT_WIDTH, RECEIPT_HEIGHT, 1).create()
        val page = pdfDocument.startPage(pageInfo)
        val canvas = page.canvas
        val paint = Paint().apply {
            textSize = 10f
            isAntiAlias = true
        }

        var yPosition = MARGIN

        settings?.let {
            canvas.drawText(it.shopName ?: "Pebot", MARGIN.toFloat(), yPosition.toFloat(), paint)
            yPosition += LINE_HEIGHT
            it.address?.let { addr ->
                canvas.drawText(addr, MARGIN.toFloat(), yPosition.toFloat(), paint)
                yPosition += LINE_HEIGHT
            }
            it.tin?.let { tin ->
                canvas.drawText("TIN: $tin", MARGIN.toFloat(), yPosition.toFloat(), paint)
                yPosition += LINE_HEIGHT
            }
        } ?: run {
            canvas.drawText("Pebot Receipt", MARGIN.toFloat(), yPosition.toFloat(), paint)
            yPosition += LINE_HEIGHT
        }

        yPosition += 5

        canvas.drawText("Order #${order.orderNumber}", MARGIN.toFloat(), yPosition.toFloat(), paint)
        yPosition += LINE_HEIGHT
        canvas.drawText("Table: ${order.tableId ?: "N/A"}", MARGIN.toFloat(), yPosition.toFloat(), paint)
        yPosition += LINE_HEIGHT

        val formatter = java.text.NumberFormat.getCurrencyInstance(java.util.Locale("en", "PH"))

        orderItems.forEach { item ->
            val productName = products.find { it.id == item.productId }?.name ?: "Item ${item.productId}"
            canvas.drawText(
                "${item.quantity}x $productName - ${formatter.format(item.unitPrice * item.quantity)}",
                MARGIN.toFloat(),
                yPosition.toFloat(),
                paint
            )
            yPosition += LINE_HEIGHT
        }

        yPosition += 5
        val subtotal = orderItems.sumOf { it.subtotal }
        canvas.drawText("Subtotal: ${formatter.format(subtotal)}", MARGIN.toFloat(), yPosition.toFloat(), paint)
        yPosition += LINE_HEIGHT

        if (order.discountAmount > 0) {
            canvas.drawText("Discount: -${formatter.format(order.discountAmount)}", MARGIN.toFloat(), yPosition.toFloat(), paint)
            yPosition += LINE_HEIGHT
        }

        paint.textSize = 12f
        paint.textSkewX = -0.25f
        canvas.drawText("TOTAL: ${formatter.format(order.totalAmount)}", MARGIN.toFloat(), yPosition.toFloat(), paint)
        yPosition += LINE_HEIGHT
        paint.textSkewX = 0f

        canvas.drawText("Thank you!", MARGIN.toFloat(), yPosition.toFloat(), paint)

        pdfDocument.finishPage(page)

        val file = File(context.filesDir, "receipt_${order.orderNumber}.pdf")
        FileOutputStream(file).use { pdfDocument.writeTo(it) }
        pdfDocument.close()

        return file
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
                android.print.PrintDocumentInfo.Builder("receipt.pdf")
                    .setContentType(android.print.PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                    .setPageCount(1)
                    .build(),
                !cancellationSignal?.isCanceled!!
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
                    FileOutputStream(fd.fileDescriptor).use { fos ->
                        val input = pdfFile.inputStream()
                        input.copyTo(fos)
                        input.close()
                        writeResultCallback?.onWriteFinished(arrayOf(android.print.PageRange.ALL_PAGES))
                    }
                }
            } catch (e: IOException) {
                writeResultCallback?.onWriteFailed(null)
            }
        }
    }

    fun printKitchenOrder(order: Order, items: List<OrderItem>, products: List<Product>) {
        Log.d(TAG, "Printing kitchen order for ${order.orderNumber}")
    }
}
