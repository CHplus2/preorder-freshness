import DialogFeedback from '../DialogFeedback';
import ModalDialog from '../ModalDialog';
import { motion } from "framer-motion";
import { useUI } from "../../contexts/UIProvider";
import { useProduct } from "../../contexts/ProductProvider";
import "./DeleteProduct.css";

function DeleteProduct() {
  const { modalMotion } = useUI();
  const { productIdToDelete, setProductIdToDelete, deleteProduct } = useProduct();

  return (
    <ModalDialog label="Delete product" onDismiss={() => setProductIdToDelete(null)}>
    <div className="modal-overlay" onClick={() => setProductIdToDelete(null)}>
      <motion.div
        className="modal-content delete-modal"
        {...modalMotion}
        transition={{ ...modalMotion.transition, duration: 0.25 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Delete Product</h2>
          <DialogFeedback/>

        <p className="delete-warning">
          This action cannot be undone. Are you sure you want to delete this product?
        </p>

        <div className="delete-actions">
          <button className="cancel-btn" onClick={() => setProductIdToDelete(null)}>
            Cancel
          </button>

          <button className="delete-btn" onClick={() => deleteProduct(productIdToDelete)}>
            Delete
          </button>
        </div>
      </motion.div>
    </div>
    </ModalDialog>
  );
}

export default DeleteProduct;